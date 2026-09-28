import { GAME_CONFIG } from '../gameConfig'
import { steerTowards } from '../steering'
import {
  CharacterController,
  Fainted,
  MovementStats,
  Position,
  Rotation,
  Velocity,
  WanderState,
  WildBehavior,
  WildCreature,
} from '../traits'

/**
 * Move cada `WildCreature` no estado `'wander'` (`WildBehavior`) por um
 * destino local aleatório. Perseguir/fugir do jogador é do
 * `wildBehaviorSystem.js`, que assume o movimento nesses estados.
 *
 * A navegação até o destino (caminho pela grade, desvio quando trava,
 * giro suave) é `steerTowards` (`core/steering.js`), a mesma usada pra
 * perseguir e fugir. Sempre `walkSpeed` (sem correr vagando) e sem
 * evasão entre personagens.
 *
 * Ciclo por criatura (`WanderState`):
 * 1. `pauseTimer > 0`: parada, decrementa, não anda.
 * 2. Perto o bastante do `target` (`ARRIVAL_DISTANCE`) OU `chaseTimer`
 *    estourou `MAX_CHASE_TIME` (destino praticamente inalcançável — desiste
 *    em vez de empurrar pra sempre contra o mesmo obstáculo, mesmo espírito
 *    de `MovementBlocked`): sorteia um novo `target` dentro de `RADIUS` de
 *    `home`, zera `chaseTimer`, sorteia novo `pauseTimer`.
 * 3. Senão: persegue o `target` atual.
 *
 * Headless. Fase: simulation, junto de `creatureFollowSystem` — antes de
 * `characterPhysicsSystem` (que integra a `Velocity` resultante contra o
 * mundo).
 */
export function wildWanderSystem(context) {
  const { world, delta } = context
  const { RADIUS, MIN_PAUSE, MAX_PAUSE, ARRIVAL_DISTANCE, MAX_CHASE_TIME } =
    GAME_CONFIG.WILD_WANDER
  world
    .query(
      WildCreature,
      WildBehavior,
      WanderState,
      CharacterController,
      MovementStats,
      Velocity,
      Rotation,
      Position,
    )
    .updateEach(([, behavior, wander, , stats, vel, rot, pos], entity) => {
      // Perseguindo/fugindo, o movimento é do `wildBehaviorSystem.js`.
      if (behavior.state !== 'wander') return
      // Desmaiada: largada no chão (`desmaiar` já zerou a velocidade).
      if (entity.has(Fainted)) return

      if (wander.pauseTimer > 0) {
        wander.pauseTimer -= delta
        vel.x = 0
        vel.z = 0
        return
      }

      wander.chaseTimer += delta
      const distanceToTarget = Math.hypot(
        wander.targetX - pos.x,
        wander.targetZ - pos.z,
      )

      if (
        distanceToTarget <= ARRIVAL_DISTANCE ||
        wander.chaseTimer >= MAX_CHASE_TIME
      ) {
        const angle = Math.random() * Math.PI * 2
        const radius = Math.random() * RADIUS
        wander.targetX = wander.homeX + Math.cos(angle) * radius
        wander.targetZ = wander.homeZ + Math.sin(angle) * radius
        wander.chaseTimer = 0
        wander.pauseTimer = MIN_PAUSE + Math.random() * (MAX_PAUSE - MIN_PAUSE)
        vel.x = 0
        vel.z = 0
        return
      }

      steerTowards(
        entity,
        { pos, rot, vel, stats },
        { x: wander.targetX, z: wander.targetZ },
        stats.walkSpeed,
        delta,
      )
    })
}
