import { describe, it, expect } from 'vitest'
import { resolveAttackTimeRemaining } from './actionTimer'

function attack(elapsed, duration) {
  return { current: 'attack', elapsed, animationSpeed: 1 / duration }
}

describe('resolveAttackTimeRemaining', () => {
  it('cheio no disparo, esvazia pela duração real da ação', () => {
    expect(resolveAttackTimeRemaining(attack(0, 2))).toBe(1)
    expect(resolveAttackTimeRemaining(attack(0.5, 2))).toBeCloseTo(0.75)
    expect(resolveAttackTimeRemaining(attack(2, 2))).toBe(0)
  })

  it('nunca passa dos limites', () => {
    expect(resolveAttackTimeRemaining(attack(3, 2))).toBe(0)
    expect(resolveAttackTimeRemaining(attack(-1, 2))).toBe(1)
  })

  it('fora de ataque → null (anel some)', () => {
    expect(
      resolveAttackTimeRemaining({ current: 'dash', elapsed: 0 }),
    ).toBeNull()
    expect(resolveAttackTimeRemaining({ current: null, elapsed: 0 })).toBeNull()
    expect(resolveAttackTimeRemaining(null)).toBeNull()
  })
})
