import { GAME_CONFIG } from '../../gameConfig'

/**
 * Nível na ESCALA DAS FÓRMULAS da série (status, dano, custo de energia,
 * CP), que foram feitas pra um teto de 100: `nível × 100 ÷ MAX_LEVEL`. Com
 * um teto menor, uma criatura no nível máximo do jogo tem os status de uma
 * nível 100 na série — o balanceamento das fórmulas continua valendo
 * (docs/features/037-experiencia-e-nivel.md, decisão 7).
 *
 * Só as fórmulas usam isto. XP ganho, curva de nível e tudo que o jogador
 * vê continuam no nível do jogo.
 *
 * Módulo à parte (só `gameConfig`) porque `levelCost.js` e os traits usam —
 * mesmo motivo de `levelCost.js` existir sozinho.
 */
export const FORMULA_MAX_LEVEL = 100

export function resolveFormulaLevel(level) {
  return (level * FORMULA_MAX_LEVEL) / GAME_CONFIG.EXPERIENCE.MAX_LEVEL
}
