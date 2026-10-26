import { describe, expect, it } from 'vitest'
import {
  applyPowerMultiplier,
  readTimeSinceDamage,
  resolveRecentDamageMultiplier,
} from './recentDamageBoost'
import { applyDamage } from '../traits/components/vitals'
import { regenerateVitals } from '../systems/vitalsRegenSystem'
import { getSkill } from '../data/skills'

// o atraso da regeneração bem maior que a janela do golpe (não limita mais)
const DELAY = getSkill('assurance').damage.recentDamageBoost.window * 4

const fresh = () => ({
  hp: 100,
  maxHp: 100,
  hpRegenPercent: 0,
  hpRegenDelay: 0,
  hpRegenDelayAfterDamage: DELAY,
  stamina: 100,
  maxStamina: 100,
  staminaRegenPercent: 0,
  staminaRegenDelay: 0,
})

function damagedAgo(seconds) {
  const vitals = fresh()
  Object.assign(vitals, applyDamage(vitals, 1, vitals.hpRegenDelayAfterDamage))
  regenerateVitals(vitals, seconds)
  return vitals
}

describe('recentDamageBoost — poder maior contra quem apanhou há pouco', () => {
  const damage = getSkill('assurance').damage
  const { window, multiplier } = damage.recentDamageBoost

  it('o Assurance declara o bônus', () => {
    expect(multiplier).toBeGreaterThan(1)
    expect(window).toBeGreaterThan(0)
  })

  it('conta o tempo desde o último dano', () => {
    expect(readTimeSinceDamage(fresh())).toBeNull()
    expect(readTimeSinceDamage(damagedAgo(window / 2))).toBeCloseTo(window / 2)
  })

  it('multiplica dentro da janela e não fora dela', () => {
    expect(resolveRecentDamageMultiplier(damage, damagedAgo(window / 2))).toBe(
      multiplier,
    )
    expect(
      resolveRecentDamageMultiplier(damage, damagedAgo(window * 1.5)),
    ).toBe(1)
    expect(resolveRecentDamageMultiplier(damage, fresh())).toBe(1)
  })

  it('a janela não depende do atraso de regeneração do alvo', () => {
    const vitals = { ...fresh(), hpRegenDelayAfterDamage: window / 4 }
    Object.assign(
      vitals,
      applyDamage(vitals, 1, vitals.hpRegenDelayAfterDamage),
    )
    regenerateVitals(vitals, window / 2)
    expect(resolveRecentDamageMultiplier(damage, vitals)).toBe(multiplier)
  })

  it('golpe sem o bônus não muda', () => {
    const tackle = getSkill('tackle').damage
    expect(resolveRecentDamageMultiplier(tackle, damagedAgo(0))).toBe(1)
    expect(applyPowerMultiplier(tackle, 1)).toBe(tackle)
  })

  it('multiplica só o poder', () => {
    const boosted = applyPowerMultiplier(damage, multiplier)
    expect(boosted.power).toBe(damage.power * multiplier)
    expect(boosted.category).toBe(damage.category)
  })
})
