import { GAME_CONFIG } from '../gameConfig'
import { resolveFormulaLevel } from '../data/species/formulaLevel'

/**
 * Custo de energia pelo nível: `(2·nível/5 + 2) × peso / COST_DIVISOR` — o
 * fator de nível da fórmula de dano, então o custo cresce junto com a barra
 * (que também sai do nível). Sem `ataque/defesa` (o custo é de quem usa) e
 * sem o `+2` do dano (senão o básico custaria quase como um golpe fraco).
 * Vale pros golpes (`actionCost.js`) e pro movimento das criaturas (corrida,
 * dash, pulo — `vitalsFromSpecies`). docs/features/035-balanceamento-
 * de-acoes-e-correcoes.md.
 *
 * `level` é o nível do jogo; a conta usa o da escala das fórmulas
 * (`resolveFormulaLevel`).
 *
 * Módulo à parte (só `gameConfig`) porque os traits (`vitals.js`) usam: o
 * `actionCost.js` puxa o motor de batalha, que puxa os traits de volta.
 */
export function resolveLevelCost(level, weight) {
  const formulaLevel = resolveFormulaLevel(level)
  return (
    (((2 * formulaLevel) / 5 + 2) * weight) /
    GAME_CONFIG.ACTION_COST.COST_DIVISOR
  )
}
