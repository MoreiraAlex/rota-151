import { GAME_CONFIG } from '../gameConfig'
import { lerpAngle } from '../math'
import { isHitStunned } from '../actions/hitStun'
import { isEating } from '../actions/eating'
import { levelWaterDepthAt } from '../actions/water'
import {
  approachFlightVelocity,
  canTakeOff,
  flightGroundY,
  gastarStaminaDeVoo,
  limitFlightVerticalSpeed,
  resolveCeilingSpeed,
  resolveFlightCeiling,
  resolveFlightIntent,
} from '../actions/flight'
import { verticalClearance } from '../physics/colliders'
import { overDeepWater } from '../terrain/water'
import {
  ActionState,
  CharacterController,
  Fainted,
  FlightStats,
  Flying,
  Grounded,
  InputControlled,
  InputState,
  Jumping,
  MovementStats,
  OrbitCamera,
  Position,
  Rotation,
  Velocity,
  Vitals,
  resolveEntityLevel,
} from '../traits'

/**
 * Voo livre (docs/features/060-ajustes-por-especie.md, Parte 2) de quem tem
 * `FlightStats`:
 *
 * - **Decolar**: `V` (`input.fly`) no chão, controlada pelo jogador, livre
 *   (sem ação, atordoamento ou comida) e com `MIN_TAKEOFF_STAMINA`. Sobe
 *   sozinha por `TAKEOFF_DURATION`.
 * - **No ar**: a velocidade inteira (as três direções) sai daqui — W voa
 *   pra onde a câmera olha e Espaço/C sobem e descem por cima disso
 *   (`resolveFlightIntent`), Shift é o rápido. Com embalo: a velocidade vai
 *   até a pedida aos poucos (`ACCELERATION`, e `BRAKE` sem tecla). No dash
 *   (que também sai no ar, `playerActionSystem`), a velocidade é a dele;
 *   aqui só os limites.
 *   Gasta stamina o tempo todo (`gastarStaminaDeVoo`) e não passa do teto
 *   (`resolveFlightCeiling`, a fração de stamina × `MAX_HEIGHT` acima do
 *   chão); acima dele, desce devagar. Sobre água funda não desce abaixo da
 *   superfície.
 * - **Pousar**: `V` de novo (ou o controle devolvido ao treinador) desce em
 *   `LANDING_SPEED`; encostar no chão descendo, depois da decolagem, pousa.
 *   Desmaiada, para de voar e cai.
 *
 * Sem controle do jogador, o deslocamento no plano é o de quem já escreveu
 * a velocidade (seguir o treinador); aqui só desce.
 *
 * Headless. Fase: simulation, depois de todo mundo que escreve `Velocity` e
 * logo antes do `characterPhysicsSystem` (que não aplica gravidade em quem
 * voa).
 */
export function flightSystem(context) {
  const { world, delta } = context
  const input = context.input ?? {}
  const cfg = GAME_CONFIG.FLIGHT
  const rig = world.queryFirst(OrbitCamera)
  const camera = rig ? rig.get(OrbitCamera) : { yaw: 0, pitch: 0 }

  const takeoffs = []
  const landings = []

  world
    .query(
      FlightStats,
      Vitals,
      Velocity,
      Rotation,
      Position,
      CharacterController,
      ActionState,
    )
    .updateEach(
      ([flight, vitals, vel, rot, pos, character, action], entity) => {
        const controlled = entity.has(InputControlled)

        if (!entity.has(Flying)) {
          if (
            controlled &&
            input.fly &&
            entity.has(Grounded) &&
            !entity.has(Fainted) &&
            action.current === null &&
            !isHitStunned(entity) &&
            !isEating(entity) &&
            canTakeOff(vitals)
          ) {
            takeoffs.push(entity)
          }
          return
        }

        if (entity.has(Fainted)) {
          landings.push(entity)
          return
        }

        const state = entity.get(Flying)
        let landing = state.landing
        if (!controlled) landing = true
        else if (input.fly && state.takeoff <= 0) landing = !landing
        const takeoff = Math.max(0, state.takeoff - delta)

        const dashing = action.current === 'dash'
        const busy = action.current !== null
        const flightInput = controlled ? entity.get(InputState) : null
        const intent =
          flightInput && !busy
            ? resolveFlightIntent(flightInput, input, camera)
            : { active: false, dir: { x: 0, y: 0, z: 0 } }
        const fast = gastarStaminaDeVoo(
          vitals,
          resolveEntityLevel(entity, null),
          delta,
          intent.active && !!flightInput.run,
        )
        const speed = fast ? flight.fastSpeed : flight.speed
        // Velocidade que o jogador PEDIU (não a que o teto força): é por ela
        // que a animação escolhe entre pairar e voar.
        const intentSpeed = intent.active
          ? Math.hypot(intent.dir.x, intent.dir.y, intent.dir.z) * speed
          : 0

        const feetY = pos.y - verticalClearance(character)
        const overWater = overDeepWater(levelWaterDepthAt, pos.x, pos.z)
        const groundY = flightGroundY(pos.x, pos.z)
        const ceiling = resolveFlightCeiling(vitals)
        // Voo normal: o teto entra no embalo como alvo (desce e freia aos
        // poucos, mesmo quando a stamina cai de uma vez). No dash, na
        // decolagem, no pouso e sem controle, ele corta direto.
        const smooth = controlled && !dashing && !landing && takeoff <= 0

        // No dash (no ar também), a velocidade é a dele (`playerActionSystem`).
        // Fora dele, com embalo: a velocidade vai até a pedida
        // (`approachFlightVelocity`) — curva em arco e, ao soltar, desliza
        // até parar.
        if (controlled && !dashing) {
          const target = {
            x: intent.dir.x * speed,
            y: landing ? 0 : intent.dir.y * speed,
            z: intent.dir.z * speed,
          }
          if (smooth) {
            target.y = Math.min(
              target.y,
              resolveCeilingSpeed({ feetY, groundY, ceiling }),
            )
          }
          approachFlightVelocity(vel, target, intent.active, delta)
        }
        if (landing) vel.y = -cfg.LANDING_SPEED
        if (takeoff > 0) vel.y = Math.max(vel.y, cfg.TAKEOFF_SPEED)

        vel.y = limitFlightVerticalSpeed({
          vy: vel.y,
          feetY,
          groundY,
          // já no embalo: aqui só o piso da água funda
          ceiling: smooth ? Infinity : ceiling,
          floorY: overWater ? GAME_CONFIG.TERRAIN.WATER_LEVEL : null,
          delta,
        })

        if (controlled && !dashing && (vel.x !== 0 || vel.z !== 0)) {
          const turnSpeed = entity.get(MovementStats)?.turnSpeed ?? 0
          rot.y = lerpAngle(rot.y, Math.atan2(vel.x, vel.z), turnSpeed * delta)
        }

        // Sobre água funda não pousa: só na margem.
        if (takeoff <= 0 && !overWater && entity.has(Grounded) && vel.y <= 0) {
          landings.push(entity)
          return
        }
        entity.set(Flying, { takeoff, landing, intentSpeed })
      },
    )

  // Fora do `updateEach`: pôr e tirar trait.
  for (const entity of takeoffs) {
    entity.remove(Jumping)
    entity.add(
      Flying({ takeoff: cfg.TAKEOFF_DURATION, landing: false, intentSpeed: 0 }),
    )
  }
  for (const entity of landings) entity.remove(Flying)
}
