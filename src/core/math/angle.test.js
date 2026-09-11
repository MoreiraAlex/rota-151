import { describe, it, expect } from 'vitest'
import { wrapAngle, lerpAngle } from './angle'

const PI = Math.PI

describe('wrapAngle', () => {
  it('mantém ângulos já dentro de (-π, π]', () => {
    expect(wrapAngle(0)).toBe(0)
    expect(wrapAngle(1)).toBeCloseTo(1)
    expect(wrapAngle(-1)).toBeCloseTo(-1)
  })

  it('normaliza ângulos fora do intervalo', () => {
    expect(wrapAngle(2 * PI)).toBeCloseTo(0)
    expect(wrapAngle(3 * PI)).toBeCloseTo(PI)
    // -3π e +π representam o mesmo ângulo (o endpoint pode sair como ±π)
    expect(Math.abs(wrapAngle(-3 * PI))).toBeCloseTo(PI)
    expect(wrapAngle(1.5 * PI)).toBeCloseTo(-0.5 * PI)
  })
})

describe('lerpAngle', () => {
  it('interpola pelo caminho mais curto passando por ±π', () => {
    // de 170° para -170°: caminho curto é +20°, não -340°
    const from = (170 * PI) / 180
    const to = (-170 * PI) / 180
    const half = lerpAngle(from, to, 0.5)
    // resultado deve estar perto de ±180°, não perto de 0
    expect(Math.abs(wrapAngle(half))).toBeGreaterThan(PI - 0.2)
  })

  it('t = 0 devolve o ângulo atual; t = 1 devolve o alvo', () => {
    expect(lerpAngle(0.3, 1.2, 0)).toBeCloseTo(0.3)
    expect(wrapAngle(lerpAngle(0.3, 1.2, 1))).toBeCloseTo(1.2)
  })

  it('fixa t no intervalo [0, 1]', () => {
    expect(lerpAngle(0, 1, 5)).toBeCloseTo(1)
    expect(lerpAngle(0, 1, -5)).toBeCloseTo(0)
  })
})
