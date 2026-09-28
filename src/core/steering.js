import { GAME_CONFIG } from './gameConfig'
import { lerpAngle } from './math'
import { findPath } from './pathfinding'
import { castRay } from './physics/raycast'
import { MovementBlocked, PathState, PhysicsBody } from './traits'

/**
 * Anda até `target` (`{x, z}`) contornando obstáculos: caminho pela grade
 * (`findPath`, recalculado a cada `REPATH_INTERVAL` ou quando trava),
 * waypoint por waypoint, e desvio lateral por raycast enquanto
 * `MovementBlocked` — mesma navegação que o `wildWanderSystem.js` sempre
 * usou, extraída pra ser reusada por vagar, perseguir e fugir
 * (`wildBehaviorSystem.js`) sem cópia. Gira o corpo suave
 * (`stats.turnSpeed`) e anda pra frente a `speed`.
 *
 * Escreve em `rot`/`vel` (os mesmos objetos do `updateEach` de quem chama)
 * e em `PathState` da entidade.
 */
export function steerTowards(
  entity,
  { pos, rot, vel, stats },
  target,
  speed,
  delta,
) {
  const {
    REPATH_INTERVAL,
    WAYPOINT_ARRIVAL_DISTANCE,
    AVOIDANCE_PROBE_DISTANCE,
  } = GAME_CONFIG.PATHFINDING

  // Travou agora (borda de subida): recalcula o caminho em vez de esperar
  // o próximo repath — o caminho antigo levou até aqui.
  const isBlocked = entity.has(MovementBlocked)
  const path = entity.get(PathState)
  let { waypoints, waypointIndex, repathTimer, wasBlocked } = path
  repathTimer -= delta
  const blockedRisingEdge = isBlocked && !wasBlocked
  if (repathTimer <= 0 || blockedRisingEdge) {
    waypoints = findPath(pos, target)
    waypointIndex = 0
    repathTimer = REPATH_INTERVAL
  }

  let targetX = target.x
  let targetZ = target.z
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
    target: { x: target.x, z: target.z },
  })

  let dirX
  let dirZ
  const baseDirX = targetX - pos.x
  const baseDirZ = targetZ - pos.z
  const baseLength = Math.hypot(baseDirX, baseDirZ) || 1

  if (isBlocked) {
    // Desvio: sonda esquerda e direita e vai pro lado mais livre.
    const nx = baseDirX / baseLength
    const nz = baseDirZ / baseLength
    const { colliderHandle } = entity.get(PhysicsBody)
    const origin = { x: pos.x, y: pos.y, z: pos.z }
    const probe = (dx, dz) => {
      const hit = castRay(
        origin,
        { x: dx, y: 0, z: dz },
        AVOIDANCE_PROBE_DISTANCE,
        { excludeColliderHandle: colliderHandle },
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
  vel.x = Math.sin(rot.y) * speed
  vel.z = Math.cos(rot.y) * speed
}
