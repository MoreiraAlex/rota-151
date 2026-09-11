import { describe, it, expect } from 'vitest'
import { clamp } from './clamp'

describe('clamp', () => {
  it('devolve o valor quando está dentro do intervalo', () => {
    expect(clamp(5, 0, 10)).toBe(5)
  })

  it('satura nos limites', () => {
    expect(clamp(-3, 0, 10)).toBe(0)
    expect(clamp(42, 0, 10)).toBe(10)
  })

  it('funciona com limites negativos', () => {
    expect(clamp(-5, -2, 2)).toBe(-2)
  })
})
