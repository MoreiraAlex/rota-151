import { describe, expect, it } from 'vitest'
import { resolveDashCost, tentarCorrer } from './stamina'

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

describe('a vida não muda o custo da corrida e do dash (063)', () => {
  const at = (fraction) => ({ hp: fraction * 100, maxHp: 100 })

  it('correr ferido gasta o mesmo que com a vida cheia', () => {
    const full = { ...vitals(10), ...at(1) }
    const hurt = { ...vitals(10), ...at(0.1) }
    tentarCorrer(full, 0.5)
    tentarCorrer(hurt, 0.5)
    expect(hurt.stamina).toBeCloseTo(full.stamina)
  })

  it('dash: o custo da entidade (Vitals.dashStaminaCost), com qualquer vida', () => {
    const cost = 2.5
    expect(resolveDashCost({ ...at(1), dashStaminaCost: cost })).toBe(cost)
    expect(resolveDashCost({ ...at(0.05), dashStaminaCost: cost })).toBe(cost)
  })
})
