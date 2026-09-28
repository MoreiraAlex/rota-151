import { entrarEmCombate } from '../actions/combat'
import { tentarCorrer } from '../actions/stamina'
import { perseguirJogador, voltarAVagar } from '../actions/wildBehavior'
import { resolveBehaviorRadius } from '../battle/wildBehavior'
import {
  findNearest,
  listPlayerSide,
  resolveAttackReach,
  resolveWildTarget,
} from '../battle/combatTargets'
import { getSpecies } from '../data/species'
import { GAME_CONFIG } from '../gameConfig'
import { lerpAngle } from '../math'
import { steerTowards } from '../steering'
import {
  ActionState,
  CharacterController,
  Fainted,
  MovementStats,
  Position,
  Rotation,
  Velocity,
  Vitals,
  WantsToAttack,
  WildBehavior,
  WildCreature,
} from '../traits'

/**
 * Alvo desta selvagem neste tick (entre `candidates`, o lado do jogador
 * ativo) e a troca de estado que ela faz (ou `null`), comparando a
 * distância até o alvo com o limite do estado atual
 * (`resolveBehaviorRadius`):
 * - vagando (hostil): o mais perto; dentro do raio de aggro → persegue;
 * - perseguindo: quem mais causou dano nela (`Threat`) ou, sem ameaça, o
 *   mais perto (`resolveWildTarget`); além do limite → volta a vagar;
 * - fugindo: foge do mais perto; além da distância segura → volta a vagar.
 * Pacífica vagando não tem limite — só muda apanhando
 * (`wildReactionSystem.js`). Sem ninguém do lado do jogador na luta, quem
 * perseguia/fugia volta a vagar.
 */
function resolveDecision(entity, behavior, pos, candidates) {
  const target =
    behavior.state === 'chase'
      ? resolveWildTarget(entity, pos, candidates)
      : findNearest(pos, candidates)

  if (!target) {
    return {
      target: null,
      next: behavior.state === 'wander' ? null : 'wander',
    }
  }

  const radius = resolveBehaviorRadius(behavior)
  if (radius === null) return { target: null, next: null }

  if (behavior.state === 'wander') {
    return target.distance <= radius
      ? { target, next: 'chase' }
      : { target: null, next: null }
  }
  return target.distance > radius
    ? { target: null, next: 'wander' }
    : { target, next: null }
}

/**
 * Comportamento das selvagens em relação ao lado do jogador — treinador e
 * criaturas do time, controladas ou não (`listPlayerSide`), não só quem
 * está no controle: hostil persegue quem chegar no raio de aggro e desiste
 * fora do limite; perseguindo, mira quem mais causou dano nela (`Threat`,
 * somado pelo `wildReactionSystem.js`) ou, sem ameaça, o mais perto
 * (`resolveWildTarget`) — lutar em grupo custa: as criaturas do time
 * também apanham. Chega até uma fração do alcance do próprio ataque
 * básico (`ATTACK_REACH_FRACTION`), para virada pro alvo e pede golpes
 * nele (`WantsToAttack`, a cada `ATTACK_INTERVAL`, lançados pelo
 * `creatureAttackSystem.js`), parada enquanto o golpe acontece; fugindo,
 * corre pra longe do mais perto até uma distância segura. Correr gasta
 * stamina (`tentarCorrer`); sem fôlego, anda. Vagar é do
 * `wildWanderSystem.js`. O alvo do tick fica em `WildBehavior.target`.
 *
 * Perseguir põe (e mantém) a selvagem em modo combate
 * (`entrarEmCombate` — olho bravo), igual a quem ataca.
 *
 * Duas passadas: decide alvo e trocas de estado lendo (`readEach`) e
 * aplica DEPOIS (as actions escrevem em `WildBehavior`, que não pode
 * mudar no meio de um `updateEach` que o percorre); depois move quem está
 * perseguindo/fugindo.
 *
 * Headless. Fase: simulation, antes do `wildWanderSystem` (quem voltou a
 * vagar neste tick já vaga no mesmo tick) e do `characterPhysicsSystem`.
 */
export function wildBehaviorSystem(context) {
  const { world, delta } = context
  const { ATTACK_INTERVAL, ATTACK_REACH_FRACTION, CHASE_STOP_GAP, FLEE_STEP } =
    GAME_CONFIG.WILD_BEHAVIOR

  const candidates = listPlayerSide(world)

  const decisions = []
  world
    .query(WildCreature, WildBehavior, Position)
    .readEach(([, behavior, pos], entity) => {
      if (entity.has(Fainted)) return
      const decision = resolveDecision(entity, behavior, pos, candidates)
      decisions.push({ entity, ...decision, pos: { ...pos } })
    })

  for (const { entity, next, target, pos } of decisions) {
    if (next === 'chase') perseguirJogador(entity, { provoked: false })
    else if (next === 'wander') voltarAVagar(entity, pos)
    entity.set(WildBehavior, { target: target?.entity ?? null })
  }

  world
    .query(
      WildCreature,
      WildBehavior,
      Position,
      Rotation,
      Velocity,
      MovementStats,
      CharacterController,
      Vitals,
    )
    .updateEach(
      ([creature, behavior, pos, rot, vel, stats, body, vitals], entity) => {
        if (behavior.state === 'wander') return
        if (entity.has(Fainted)) return
        const target = behavior.target
        if (!target) return

        const targetPos = target.get(Position)
        const targetBody = target.get(CharacterController)
        const toTarget = { x: targetPos.x - pos.x, z: targetPos.z - pos.z }
        const distance = Math.hypot(toTarget.x, toTarget.z)
        const moving = { pos, rot, vel, stats }
        // Correr (perseguir/fugir) gasta stamina; sem fôlego, anda.
        const runOrWalk = () =>
          tentarCorrer(vitals, delta) ? stats.runSpeed : stats.walkSpeed

        if (behavior.state === 'flee') {
          const away = distance > 1e-6 ? distance : 1
          const fleeTarget = {
            x: pos.x - (toTarget.x / away) * FLEE_STEP,
            z: pos.z - (toTarget.z / away) * FLEE_STEP,
          }
          steerTowards(entity, moving, fleeTarget, runOrWalk(), delta)
          return
        }

        entrarEmCombate(entity)
        behavior.attackTimer = Math.max(0, behavior.attackTimer - delta)

        // Golpe em andamento: fica parada (o golpe já virou o corpo).
        if (entity.get(ActionState).current !== null) {
          vel.x = 0
          vel.z = 0
          return
        }

        const reach = resolveAttackReach(
          getSpecies(creature.speciesId),
          targetBody,
        )
        const stopDistance =
          reach !== null
            ? reach * ATTACK_REACH_FRACTION
            : body.capsuleRadius + targetBody.capsuleRadius + CHASE_STOP_GAP

        if (distance > stopDistance) {
          steerTowards(entity, moving, targetPos, runOrWalk(), delta)
        } else {
          // Perto o bastante: para e encara o alvo.
          vel.x = 0
          vel.z = 0
          rot.y = lerpAngle(
            rot.y,
            Math.atan2(toTarget.x, toTarget.z),
            stats.turnSpeed * delta,
          )
        }

        // Ao alcance e com o intervalo vencido: pede o golpe nele
        // (`creatureAttackSystem.js` lança no próximo tick).
        if (reach !== null && distance <= reach && behavior.attackTimer <= 0) {
          entity.add(WantsToAttack({ target }))
          behavior.attackTimer = ATTACK_INTERVAL
        }
      },
    )
}
