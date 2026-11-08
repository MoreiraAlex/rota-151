import { describe, expect, it } from 'vitest'
import { resolveMoveSpeed } from './movementSpeed'

describe('resolveMoveSpeed', () => {
  const stats = { walkSpeed: 2, runSpeed: 5 }

  it('andar e correr: a velocidade da espécie', () => {
    expect(resolveMoveSpeed(stats, true)).toBe(stats.runSpeed)
    expect(resolveMoveSpeed(stats, false)).toBe(stats.walkSpeed)
  })

  it('o modificador de passo das condições multiplica andar e correr', () => {
    const modifier = 0.5
    for (const running of [false, true]) {
      const base = resolveMoveSpeed(stats, running)
      expect(resolveMoveSpeed(stats, running, modifier)).toBeCloseTo(
        base * modifier,
      )
    }
  })
})
