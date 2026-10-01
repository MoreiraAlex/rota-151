import { GAME_CONFIG } from '@/core/gameConfig'
import { isPlayerSide } from '@/core/battle/combatTargets'

const { OPPONENT, ALLY } = GAME_CONFIG.FEEDBACK.FEEDBACK_COLORS

/** Tipos de acontecimento que ganham cor: dano, dano crítico, status negativo e status positivo. */
export const FEEDBACK_KINDS = ['damage', 'crit', 'debuff', 'buff']

/**
 * Lado de uma entidade: `'ally'` (o treinador e as criaturas do time) ou
 * `'opponent'` (todo o resto — selvagens). Aceita qualquer valor sem quebrar:
 * algo que não seja uma entidade do ECS conta como oponente.
 */
export function resolveSide(entity) {
  return typeof entity?.has === 'function' && isPlayerSide(entity)
    ? 'ally'
    : 'opponent'
}

/**
 * Cor (`#rrggbb`) do feedback pra um `kind` (`'damage'`, `'crit'`, `'debuff'`,
 * `'buff'`)
 * e um `side` (`'ally'`, `'opponent'`) — `GAME_CONFIG.FEEDBACK.FEEDBACK_COLORS`.
 * Usada pelo brilho do modelo e pelos textos acima da cabeça, pra os dois
 * sempre concordarem.
 */
export function resolveFeedbackColor(kind, side) {
  const palette = side === 'ally' ? ALLY : OPPONENT
  return palette[kind.toUpperCase()] ?? palette.DAMAGE
}
