import { describe, expect, it } from 'vitest'
import { GAME_CONFIG } from '../gameConfig'
import { clearingNoiseAt, opennessOf } from './clearings'

const POINTS = Array.from({ length: 400 }, (_, i) => [
  (i % 20) * 13.7 - 120,
  Math.floor(i / 20) * 11.3 - 90,
])

describe('clearingNoiseAt', () => {
  it('entre 0 e 1, e igual para a mesma seed e ponto', () => {
    for (const [x, z] of POINTS) {
      const value = clearingNoiseAt(4, x, z)
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThanOrEqual(1)
      expect(clearingNoiseAt(4, x, z)).toBe(value)
    }
  })

  it('seeds diferentes, manchas diferentes', () => {
    const differs = POINTS.some(
      ([x, z]) => clearingNoiseAt(4, x, z) !== clearingNoiseAt(5, x, z),
    )
    expect(differs).toBe(true)
  })

  it('suave: pontos vizinhos quase iguais', () => {
    const step = GAME_CONFIG.CLEARINGS.SIZE / 100
    for (const [x, z] of POINTS) {
      expect(
        Math.abs(clearingNoiseAt(4, x, z) - clearingNoiseAt(4, x + step, z)),
      ).toBeLessThan(0.1)
    }
  })
})

describe('opennessOf', () => {
  it('sem clareira no bioma: nunca aberto', () => {
    for (const noise of [0, 0.5, 1]) expect(opennessOf(noise, 0)).toBe(0)
  })

  it('mais clareira no bioma, mais área aberta', () => {
    const openArea = (amount) =>
      POINTS.reduce(
        (sum, [x, z]) => sum + opennessOf(clearingNoiseAt(4, x, z), amount),
        0,
      )
    expect(openArea(0.6)).toBeGreaterThan(openArea(0.2))
  })
})
