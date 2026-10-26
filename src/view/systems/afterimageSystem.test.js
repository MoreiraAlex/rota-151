import { describe, expect, it } from 'vitest'
import {
  resolveAfterimageOffsets,
  resolveAfterimageOpacity,
  resolveAfterimageSlide,
} from './afterimageSystem'
import { getSkill } from '@/core/data/skills'

const spec = getSkill('double-team').visual.afterimages

describe('afterimageSystem — os vultos do Double Team', () => {
  it('o Double Team declara vultos', () => {
    expect(spec.count).toBeGreaterThan(0)
  })

  it('os vultos alternam os lados e cada par vai mais longe', () => {
    const offsets = resolveAfterimageOffsets(4, 1)
    expect(Math.sign(offsets[0])).toBe(-Math.sign(offsets[1]))
    expect(Math.abs(offsets[2])).toBeGreaterThan(Math.abs(offsets[0]))
    expect(offsets.reduce((sum, value) => sum + value, 0)).toBeCloseTo(0)
  })

  it('saem do corpo e chegam no lugar', () => {
    expect(resolveAfterimageSlide(0)).toBe(0)
    expect(resolveAfterimageSlide(1)).toBe(1)
  })

  it('piscam e apagam até o fim da vida', () => {
    expect(resolveAfterimageOpacity(0, spec)).toBeCloseTo(spec.opacity)
    expect(resolveAfterimageOpacity(1, spec)).toBe(0)
    const samples = Array.from({ length: 50 }, (_, i) =>
      resolveAfterimageOpacity(i / 50, spec),
    )
    expect(samples.some((value) => value === 0)).toBe(true)
    expect(samples.some((value) => value > 0)).toBe(true)
  })
})
