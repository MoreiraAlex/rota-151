import { describe, expect, it } from 'vitest'
import { SOUND_FALLOFF, distanceGain } from './soundRanges'

// Queda do volume com a distância (docs/features/062-spawn-estilo-
// cobblemon.md). Números só de teste.

const RANGE = { refDistance: 2, maxDistance: 10 }
const linear = (distance) =>
  1 - (distance - RANGE.refDistance) / (RANGE.maxDistance - RANGE.refDistance)

describe('distanceGain', () => {
  it('cheio até o começo do alcance e zero do fim em diante', () => {
    expect(distanceGain(0, RANGE)).toBe(1)
    expect(distanceGain(RANGE.refDistance, RANGE)).toBe(1)
    expect(distanceGain(RANGE.maxDistance, RANGE)).toBe(0)
    expect(distanceGain(RANGE.maxDistance + 1, RANGE)).toBe(0)
  })

  it('cai sempre, sem degrau, do começo ao fim do alcance', () => {
    let previous = 1
    for (let d = RANGE.refDistance + 0.5; d < RANGE.maxDistance; d += 0.5) {
      const gain = distanceGain(d, RANGE)
      expect(gain).toBeLessThan(previous)
      expect(gain).toBeGreaterThan(0)
      previous = gain
    }
  })

  it('com expoente um é a reta', () => {
    const middle = (RANGE.refDistance + RANGE.maxDistance) / 2
    expect(distanceGain(middle, RANGE, 1)).toBeCloseTo(linear(middle))
  })

  it('o padrão cai mais cedo que a reta (soa gradual, sem corte no fim)', () => {
    const middle = (RANGE.refDistance + RANGE.maxDistance) / 2
    expect(distanceGain(middle, RANGE)).toBeLessThan(linear(middle))
    expect(SOUND_FALLOFF.CURVE).toBeGreaterThan(1)
  })
})
