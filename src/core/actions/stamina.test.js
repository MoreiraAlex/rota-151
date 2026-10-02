import { describe, expect, it } from 'vitest'
import { GAME_CONFIG } from '../gameConfig'
import {
  resolveDashCost,
  resolveMovementCostMultiplier,
  tentarCorrer,
} from './stamina'

const { MAX_MULTIPLIER, EXPONENT } = GAME_CONFIG.STAMINA_BY_HP

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

describe('custo da corrida e do dash pela vida baixa', () => {
  const at = (fraction) => ({ hp: fraction * 100, maxHp: 100 })

  it('×1 com a vida cheia, MAX com ela em 0, pela curva no meio', () => {
    expect(resolveMovementCostMultiplier(at(1))).toBe(1)
    expect(resolveMovementCostMultiplier(at(0))).toBe(MAX_MULTIPLIER)
    expect(resolveMovementCostMultiplier(at(0.5))).toBeCloseTo(
      1 + (MAX_MULTIPLIER - 1) * 0.5 ** EXPONENT,
    )
    expect(resolveMovementCostMultiplier({})).toBe(1) // sem vida
  })

  it('correr ferido gasta o drain × o multiplicador', () => {
    const v = { ...vitals(10), ...at(0.5) }
    tentarCorrer(v, 0.5)
    expect(v.stamina).toBeCloseTo(
      10 - 2 * 0.5 * resolveMovementCostMultiplier(v),
    )
  })

  it('ferido sem fôlego pro custo maior: não corre', () => {
    const v = { ...vitals(1.5), ...at(0) } // custaria 2 × 0.5 × MAX
    expect(tentarCorrer(v, 0.5)).toBe(false)
  })

  it('dash: o custo da entidade (Vitals.dashStaminaCost) × o multiplicador', () => {
    const cost = 2.5
    expect(resolveDashCost({ ...at(1), dashStaminaCost: cost })).toBe(cost)
    expect(resolveDashCost({ ...at(0), dashStaminaCost: cost })).toBe(
      cost * MAX_MULTIPLIER,
    )
  })
})
