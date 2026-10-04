import { describe, expect, it } from 'vitest'
import { GAME_CONFIG } from '../../gameConfig'
import { FORMULA_MAX_LEVEL, resolveFormulaLevel } from './formulaLevel'

describe('resolveFormulaLevel', () => {
  it('o nível máximo do jogo vira o máximo das fórmulas', () => {
    expect(resolveFormulaLevel(GAME_CONFIG.EXPERIENCE.MAX_LEVEL)).toBe(
      FORMULA_MAX_LEVEL,
    )
  })

  it('é proporcional ao nível do jogo', () => {
    const { MAX_LEVEL } = GAME_CONFIG.EXPERIENCE
    expect(resolveFormulaLevel(MAX_LEVEL / 2)).toBeCloseTo(
      FORMULA_MAX_LEVEL / 2,
    )
    expect(resolveFormulaLevel(0)).toBe(0)
  })
})
