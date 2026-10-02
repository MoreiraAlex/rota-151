import { describe, expect, it } from 'vitest'
import { GAME_CONFIG } from '../gameConfig'
import { resolveMoveSpeed, resolveSpeedMultiplier } from './movementSpeed'

const { MIN_MULTIPLIER, EXPONENT } = GAME_CONFIG.SPEED_BY_HP
const at = (fraction) => ({ hp: fraction * 100, maxHp: 100 })

describe('velocidade pela vida baixa', () => {
  it('×1 com a vida cheia, MIN com ela em 0, pela curva no meio', () => {
    expect(resolveSpeedMultiplier(at(1))).toBe(1)
    expect(resolveSpeedMultiplier(at(0))).toBeCloseTo(MIN_MULTIPLIER)
    expect(resolveSpeedMultiplier(at(0.5))).toBeCloseTo(
      1 - (1 - MIN_MULTIPLIER) * 0.5 ** EXPONENT,
    )
    expect(resolveSpeedMultiplier({})).toBe(1) // sem vida
  })

  it('andar e correr: a velocidade da espécie × o multiplicador', () => {
    const stats = { walkSpeed: 2, runSpeed: 5 }
    expect(resolveMoveSpeed(stats, at(1), true)).toBe(5)
    expect(resolveMoveSpeed(stats, at(1), false)).toBe(2)
    expect(resolveMoveSpeed(stats, at(0), true)).toBeCloseTo(5 * MIN_MULTIPLIER)
  })
})
