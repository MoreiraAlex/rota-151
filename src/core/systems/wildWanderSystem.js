import { GAME_CONFIG } from '../gameConfig'
import { lerpAngle } from '../math'
import { findPath } from '../pathfinding'
import { castRay } from '../physics/raycast'
import {
  CharacterController,
  MovementBlocked,
  MovementStats,
  PathState,
  PhysicsBody,
  Position,
  Rotation,
  Velocity,
  WanderState,
  WildCreature,
} from '../traits'

/**
 * Move cada `WildCreature` sozinha por um destino local aleatório — sem
 * perseguir o treinador nem nenhum outro personagem (ver docstring de
 * `WildCreature`/docs/features/020-fox-selvagens-cena-e-texturas.md,
 * "sem interações por enquanto").
 *
 * Reaproveita a MESMA técnica de perseguir um ponto que
 * `creatureFollowSystem.js` já usa — `findPath`/`PathState` com
 * `PATHFINDING.REPATH_INTERVAL`, evasão local via `MovementBlocked`/
 * `castRay` na borda de subida do bloqueio, `Rotation` suavizada
 * (`lerpAngle`) da qual `Velocity` deriva — mas por CÓPIA direta, não por
 * um helper compartilhado entre os dois systems: mesmo precedente já usado
 * nesta feature (`footstepGroups.js`/`actionSoundGroups.js`, docs/
 * features/019-som-ambiente-e-passos.md) de não mexer em código já
 * testado/em produção só pra generalizar por generalizar. Sempre
 * `walkSpeed` (sem correr vagando) e SEM evasão entre personagens
 * (`AVOIDANCE_RADIUS` de `creatureFollowSystem.js`) — fora de escopo por
 * enquanto.
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
  const {
    REPATH_INTERVAL,
    WAYPOINT_ARRIVAL_DISTANCE,
    AVOIDANCE_PROBE_DISTANCE,
  } = GAME_CONFIG.PATHFINDING

  world
    .query(
      WildCreature,
      WanderState,
      CharacterController,
      MovementStats,
      Velocity,
      Rotation,
      Position,
    )
    .updateEach(([, wander, , stats, vel, rot, pos], entity) => {
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

      const isBlocked = entity.has(MovementBlocked)

      // `PathState` é AoS (ver docstring do trait) — lido/escrito por fora
      // da query ativa, mesma convenção de `creatureFollowSystem.js`.
      const path = entity.get(PathState)
      let { waypoints, waypointIndex, repathTimer, wasBlocked } = path
      repathTimer -= delta

      const blockedRisingEdge = isBlocked && !wasBlocked
      if (repathTimer <= 0 || blockedRisingEdge) {
        waypoints = findPath(pos, { x: wander.targetX, z: wander.targetZ })
        waypointIndex = 0
        repathTimer = REPATH_INTERVAL
      }

      let targetX = wander.targetX
      let targetZ = wander.targetZ
      if (waypointIndex < waypoints.length) {
        const waypoint = waypoints[waypointIndex]
        if (
          Math.hypot(waypoint.x - pos.x, waypoint.z - pos.z) <=
          WAYPOINT_ARRIVAL_DISTANCE
        ) {
          waypointIndex += 1
        }
        if (waypointIndex < waypoints.length) {
          targetX = waypoints[waypointIndex].x
          targetZ = waypoints[waypointIndex].z
        }
      }

      entity.set(PathState, {
        waypoints,
        waypointIndex,
        repathTimer,
        wasBlocked: isBlocked,
      })

      let dirX
      let dirZ
      const baseDirX = targetX - pos.x
      const baseDirZ = targetZ - pos.z
      const baseLength = Math.hypot(baseDirX, baseDirZ) || 1

      if (isBlocked) {
        const nx = baseDirX / baseLength
        const nz = baseDirZ / baseLength
        const { colliderHandle } = entity.get(PhysicsBody)
        const origin = { x: pos.x, y: pos.y, z: pos.z }
        const probe = (dx, dz) => {
          const hit = castRay(
            origin,
            { x: dx, y: 0, z: dz },
            AVOIDANCE_PROBE_DISTANCE,
            {
              excludeColliderHandle: colliderHandle,
            },
          )
          return hit ? hit.distance : AVOIDANCE_PROBE_DISTANCE
        }
        const left = { x: -nz, z: nx }
        const right = { x: nz, z: -nx }
        const chosen =
          probe(left.x, left.z) >= probe(right.x, right.z) ? left : right
        dirX = chosen.x
        dirZ = chosen.z
      } else {
        dirX = baseDirX
        dirZ = baseDirZ
      }

      const dirLength = Math.hypot(dirX, dirZ) || 1
      const facing = Math.atan2(dirX / dirLength, dirZ / dirLength)
      rot.y = lerpAngle(rot.y, facing, stats.turnSpeed * delta)

      vel.x = Math.sin(rot.y) * stats.walkSpeed
      vel.z = Math.cos(rot.y) * stats.walkSpeed
    })
}
