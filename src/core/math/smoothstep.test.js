import { describe, expect, it } from 'vitest'
import { smoothstep } from './smoothstep'

describe('smoothstep', () => {
  it('0 antes da primeira borda, 1 depois da segunda, meio no meio', () => {
    expect(smoothstep(2, 4, 1)).toBe(0)
    expect(smoothstep(2, 4, 5)).toBe(1)
    expect(smoothstep(2, 4, 3)).toBeCloseTo(0.5)
  })

  it('sobe sem voltar', () => {
    let previous = 0
    for (let x = 2; x <= 4; x += 0.1) {
      const value = smoothstep(2, 4, x)
      expect(value).toBeGreaterThanOrEqual(previous)
      previous = value
    }
  })
})
