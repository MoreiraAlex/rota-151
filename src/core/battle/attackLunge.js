import { GAME_CONFIG } from '../gameConfig'
import { resolveAttackTarget, resolveEntityTriggerEdge } from './attackTargets'
import { resolveFootElevation } from './attackGeometry'

/**
 * Arrancada do golpe (`lunge: { distance, duration }` da skill,
 * docs/features/061-revisao-das-skills.md — o Quick Attack): a partir do
 * `effectAt` quem ataca corre na direção do golpe por `duration` segundos e o
 * ACERTO vem quando ela chega (`resolveImpactAt`), de onde chegou — o golpe
 * alcança `distance` a mais que o `range`. Sem arrancada, o acerto é no
 * `effectAt`, como sempre.
 */

/** Quanto o golpe arranca (m); `0` sem arrancada. */
export function resolveLungeDistance(attack) {
  return Math.max(0, attack?.lunge?.distance ?? 0)
}

/** Quanto a arrancada dura (s, na unidade do golpe); `0` sem arrancada. */
export function resolveLungeTime(attack) {
  return resolveLungeDistance(attack) > 0
    ? Math.max(0, attack.lunge.duration ?? 0)
    : 0
}

/**
 * Instante do ACERTO (s desde o disparo, na unidade do golpe): o `effectAt`
 * mais a arrancada. É o que o aviso no chão enche até, o que a carga e a
 * interrupção olham e quando o dano sai.
 */
export function resolveImpactAt(attack) {
  return attack.effectAt + resolveLungeTime(attack)
}

/**
 * Quanto a arrancada vai andar agora (m): a distância toda, ou até encostar
 * no primeiro alvo no caminho — a mesma conta do acerto (`resolveAttackTarget`,
 * a cápsula do golpe a partir da borda da frente de quem ataca), com o
 * alcance esticado pela arrancada; ela para a `LUNGE_STOP_GAP` da borda dele.
 */
export function planLungeDistance(world, context) {
  const { entity, attack, pos, controller, direction, targetSide } = context
  const distance = resolveLungeDistance(attack)
  if (distance <= 0) return 0

  const length = Math.hypot(direction.x, direction.z)
  if (length < 1e-6) return 0
  const dir = { x: direction.x / length, z: direction.z / length }
  const edge = resolveEntityTriggerEdge(entity, { x: dir.x, y: 0, z: dir.z })
  const start = { x: pos.x + dir.x * edge, y: pos.y, z: pos.z + dir.z * edge }
  const reach = distance + attack.range
  const end = {
    x: start.x + dir.x * reach,
    y: pos.y,
    z: start.z + dir.z * reach,
  }
  const target = resolveAttackTarget(
    world,
    start,
    end,
    attack.radius,
    resolveFootElevation(pos, controller),
    targetSide,
  )
  if (!target) return distance

  const contact = target.contactPoint
  const gap = (contact.x - start.x) * dir.x + (contact.z - start.z) * dir.z
  return Math.min(
    distance,
    Math.max(0, gap - GAME_CONFIG.BATTLE.LUNGE_STOP_GAP),
  )
}

/**
 * Velocidade (m/s) da arrancada neste tick: o que falta, no ritmo que faz
 * chegar um pouco antes do acerto (`LUNGE_WINDOW` do tempo da arrancada,
 * `lungeTime`, em segundos reais), sem passar do plano. `{ speed, step }` —
 * `step` é quanto anda no tick.
 */
export function resolveLungeStep(lunge, lungeTime, delta) {
  const remaining = Math.max(0, lunge.distance - lunge.travelled)
  if (remaining <= 0 || !(delta > 0)) return { speed: 0, step: 0 }
  const window = Math.max(lungeTime * GAME_CONFIG.BATTLE.LUNGE_WINDOW, delta)
  const step = Math.min(remaining, (lunge.distance / window) * delta)
  return { speed: step / delta, step }
}
