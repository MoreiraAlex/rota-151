import { describe, expect, it } from 'vitest'
import { patchAt } from './patches'

const POINTS = Array.from({ length: 400 }, (_, i) => [
  (i % 20) * 9.7 - 90,
  Math.floor(i / 20) * 8.3 - 70,
])
const PATCHES = { amount: 0.4, size: 20 }

const coverage = (seed, kind, patches) =>
  POINTS.reduce((sum, [x, z]) => sum + patchAt(seed, kind, patches, x, z), 0) /
  POINTS.length

describe('patchAt', () => {
  it('entre 0 e 1, e igual para a mesma seed, tipo e ponto', () => {
    for (const [x, z] of POINTS) {
      const value = patchAt(5, 'fern', PATCHES, x, z)
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThanOrEqual(1)
      expect(patchAt(5, 'fern', PATCHES, x, z)).toBe(value)
    }
  })

  it('agrupa: parte do chão fica fora da mancha e parte dentro', () => {
    const values = POINTS.map(([x, z]) => patchAt(5, 'fern', PATCHES, x, z))
    expect(values.some((value) => value === 0)).toBe(true)
    expect(values.some((value) => value === 1)).toBe(true)
  })

  it('mais `amount`, mais chão coberto', () => {
    const small = coverage(5, 'fern', { ...PATCHES, amount: 0.2 })
    const large = coverage(5, 'fern', { ...PATCHES, amount: 0.7 })
    expect(large).toBeGreaterThan(small)
  })

  it('cada tipo tem as próprias manchas', () => {
    const differs = POINTS.some(
      ([x, z]) =>
        patchAt(5, 'fern', PATCHES, x, z) !==
        patchAt(5, 'mushroom', PATCHES, x, z),
    )
    expect(differs).toBe(true)
  })
})
