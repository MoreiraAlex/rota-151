import { GAME_CONFIG } from '../gameConfig'
import { wrapAngle } from '../math'

/**
 * Se uma selvagem em `pos`, virada para `yaw` (`Rotation.y` — a frente é
 * `(sin yaw, cos yaw)` no plano), percebe quem está em `otherPos`
 * (docs/features/063-revisao-da-ia-selvagem.md): dentro do cone de visão
 * (`VIEW_HALF_ANGLE` para cada lado da frente) até `VIEW_DISTANCE`, ou a até
 * `NEAR_RADIUS` em qualquer direção. Distâncias no plano. Sem linha de visão
 * (árvore e pedra não escondem). Fonte única: o `wildAwarenessSystem.js`
 * decide por ela e o debug desenha o mesmo cone.
 */
export function isPerceived(
  pos,
  yaw,
  otherPos,
  config = GAME_CONFIG.WILD_BEHAVIOR.PERCEPTION,
) {
  const dx = otherPos.x - pos.x
  const dz = otherPos.z - pos.z
  const distance = Math.hypot(dx, dz)
  if (distance <= config.NEAR_RADIUS) return true
  if (distance > config.VIEW_DISTANCE) return false
  const offset = Math.abs(wrapAngle(Math.atan2(dx, dz) - yaw))
  return offset <= config.VIEW_HALF_ANGLE
}

/**
 * O mais perto que a selvagem percebe entre `candidates` (`[{ entity, pos }]`,
 * o lado do jogador): `{ entity, pos, distance }` ou `null`.
 */
export function findPerceived(pos, yaw, candidates) {
  let best = null
  for (const candidate of candidates) {
    if (!isPerceived(pos, yaw, candidate.pos)) continue
    const distance = Math.hypot(
      candidate.pos.x - pos.x,
      candidate.pos.z - pos.z,
    )
    if (!best || distance < best.distance) {
      best = { entity: candidate.entity, pos: candidate.pos, distance }
    }
  }
  return best
}
