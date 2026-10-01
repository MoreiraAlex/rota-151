/**
 * Fração (0-1) do tempo que AINDA FALTA na ação de ataque em andamento —
 * 1 no disparo, 0 no fim da `duration` real (`1 / ActionState.
 * animationSpeed`, já com a escala do `speed` no básico). Alimenta o anel
 * de tempo em volta da criatura controlada (`view/scene/
 * ActionTimerRingView.jsx`), estilo barra de stamina do Valheim: esvazia
 * até a criatura ficar livre de novo.
 *
 * `null` fora de ataque (o anel some).
 */
export function resolveAttackTimeRemaining(action) {
  if (!action || action.current !== 'attack') return null
  const progress = action.elapsed * (action.animationSpeed || 1)
  return Math.min(1, Math.max(0, 1 - progress))
}
