import { describe, expect, it } from 'vitest'
import { tentarCorrer } from './stamina'

function vitals(stamina) {
  return {
    stamina,
    runStaminaDrainPerSecond: 2,
    staminaRegenDelay: 0,
    staminaRegenDelayAfterUse: 3,
  }
}

describe('tentarCorrer', () => {
  it('com fôlego: corre, gasta drain × delta e reseta o delay de regeneração', () => {
    const v = vitals(10)

    expect(tentarCorrer(v, 0.5)).toBe(true)
    expect(v.stamina).toBeCloseTo(9)
    expect(v.staminaRegenDelay).toBe(3)
  })

  it('sem fôlego pro tick: não corre e não mexe em nada', () => {
    const v = vitals(0.5)

    expect(tentarCorrer(v, 0.5)).toBe(false)
    expect(v.stamina).toBe(0.5)
    expect(v.staminaRegenDelay).toBe(0)
  })
})
