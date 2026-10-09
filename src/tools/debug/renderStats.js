/**
 * Estatísticas de desenho do último quadro (docs/features/049-vegetacao-e-
 * floresta.md) — para medir a performance no debug (F2): quantas chamadas
 * de desenho e triângulos (com a sombra) e a densidade de pixels. Quem
 * escreve é o `RenderStatsProbe` (dentro do Canvas); quem lê, o
 * `DebugPanel`.
 */
let stats = { calls: 0, triangles: 0, dpr: 1 }
const listeners = new Set()

export const getRenderStats = () => stats

export function setRenderStats(next) {
  stats = next
  for (const listener of listeners) listener()
}

export function subscribeRenderStats(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
