import { describe, it, expect } from 'vitest'
import { applyDamage, applyHeal } from './vitals'

describe('applyDamage', () => {
  it('desconta hp e reseta o delay de regeneração', () => {
    const result = applyDamage({ hp: 50, maxHp: 100 }, 20, 3)
    expect(result).toEqual({ hp: 30, hpRegenDelay: 3 })
  })

  it('não deixa hp abaixo de zero', () => {
    const result = applyDamage({ hp: 10, maxHp: 100 }, 50, 3)
    expect(result.hp).toBe(0)
  })
})

describe('applyHeal', () => {
  it('soma hp, sem mexer no delay de regeneração', () => {
    const result = applyHeal({ hp: 50, maxHp: 100 }, 20)
    expect(result).toEqual({ hp: 70 })
  })

  it('não deixa hp passar do máximo', () => {
    const result = applyHeal({ hp: 90, maxHp: 100 }, 50)
    expect(result.hp).toBe(100)
  })
})
