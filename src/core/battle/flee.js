import { GAME_CONFIG } from '../gameConfig'
import { isWalkableAt } from '../pathfinding'

function horizontalDistance(a, b) {
  return Math.hypot(b.x - a.x, b.z - a.z)
}

/** O segmento de `from` até `to` passa só por células andáveis? */
function isClearLine(from, to) {
  const { CELL_SIZE } = GAME_CONFIG.PATHFINDING
  const length = horizontalDistance(from, to)
  const steps = Math.max(1, Math.ceil(length / (CELL_SIZE / 2)))
  for (let i = 1; i <= steps; i++) {
    const t = i / steps
    const x = from.x + (to.x - from.x) * t
    const z = from.z + (to.z - from.z) * t
    if (!isWalkableAt(x, z)) return false
  }
  return true
}

/**
 * Destino de fuga (docs/features/034-ia-de-batalha.md, Parte 3 — correção):
 * antes era sempre `FLEE_STEP` à frente na direção oposta a quem persegue; com
 * obstáculo ou a borda do mapa no caminho, o destino caía num lugar sem
 * caminho e a criatura corria contra a parede. Agora testa
 * `FLEE_DIRECTIONS` direções em volta, a `FLEE_STEP` dela, e fica com o ponto
 * ANDÁVEL (`isWalkableAt`, dentro do mapa) que deixa ela mais longe de quem
 * persegue — com bônus (`FLEE_CLEAR_LINE_BONUS`, m) se o caminho reto até ele
 * está livre. Num canto, escapa de lado, ao longo da parede. Nenhum andável →
 * `null` (quem chama mantém o que tinha).
 */
export function resolveFleeDestination(pos, threatPos) {
  const { FLEE_STEP, FLEE_DIRECTIONS, FLEE_CLEAR_LINE_BONUS } =
    GAME_CONFIG.WILD_BEHAVIOR
  let best = null
  for (let i = 0; i < FLEE_DIRECTIONS; i++) {
    const angle = (i / FLEE_DIRECTIONS) * Math.PI * 2
    const point = {
      x: pos.x + Math.sin(angle) * FLEE_STEP,
      z: pos.z + Math.cos(angle) * FLEE_STEP,
    }
    if (!isWalkableAt(point.x, point.z)) continue
    const score =
      horizontalDistance(point, threatPos) +
      (isClearLine(pos, point) ? FLEE_CLEAR_LINE_BONUS : 0)
    if (!best || score > best.score) best = { point, score }
  }
  return best?.point ?? null
}
