/**
 * Entidade → segundos que AINDA faltam de hit stop (animação congelada
 * após um acerto). Escrito só por `view/systems/hitStopSystem.js`; lido por
 * `animationSystem.js` (`resolveHitStopScale`). Só visual — a simulação
 * nunca lê isto.
 */
const remainingByEntity = new Map()

export function startHitStop(entity, duration) {
  if (!entity) return
  const current = remainingByEntity.get(entity) ?? 0
  remainingByEntity.set(entity, Math.max(current, duration))
}

export function advanceHitStops(delta) {
  for (const [entity, remaining] of remainingByEntity) {
    const next = remaining - delta
    if (next <= 0) remainingByEntity.delete(entity)
    else remainingByEntity.set(entity, next)
  }
}

/** `0` enquanto congelada (o relógio da animação não anda), `1` senão. */
export function resolveHitStopScale(entity) {
  return remainingByEntity.has(entity) ? 0 : 1
}

export function clearHitStops() {
  remainingByEntity.clear()
}
