import { describe, expect, it } from 'vitest'
import { formatProgressPercent } from './formatProgress'

describe('formatProgressPercent', () => {
  it('duas casas, com vírgula', () => {
    expect(formatProgressPercent(0.123456)).toBe('12,35%')
    expect(formatProgressPercent(0.0001)).toBe('0,01%')
  })

  it('fica entre 0% e 100%', () => {
    expect(formatProgressPercent(-1)).toBe('0,00%')
    expect(formatProgressPercent(2)).toBe('100,00%')
    expect(formatProgressPercent(undefined)).toBe('0,00%')
  })
})
