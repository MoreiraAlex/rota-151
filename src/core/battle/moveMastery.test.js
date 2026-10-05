import { describe, expect, it } from 'vitest'
import { MAX_MASTERY } from '../data/species/moves'
import {
  resolveMasteryAccuracyFactor,
  resolveMasteryAfterUse,
  resolveMasteryCooldownFactor,
  resolveMasteryCostFactor,
  rollMasterySuccess,
} from './moveMastery'

const FACTORS = [
  ['precisão', resolveMasteryAccuracyFactor, 'sobe'],
  ['energia', resolveMasteryCostFactor, 'desce'],
  ['recarga', resolveMasteryCooldownFactor, 'desce'],
]

describe.each(FACTORS)('fator de %s', (_, resolve, direction) => {
  it('é o clássico (1) no domínio máximo e sem domínio informado', () => {
    expect(resolve(MAX_MASTERY)).toBe(1)
    expect(resolve(undefined)).toBe(1)
  })

  it(`${direction} conforme o domínio cresce`, () => {
    const low = resolve(0)
    const mid = resolve(MAX_MASTERY / 2)
    const high = resolve(MAX_MASTERY)
    if (direction === 'sobe') {
      expect(low).toBeLessThan(mid)
      expect(mid).toBeLessThan(high)
    } else {
      expect(low).toBeGreaterThan(mid)
      expect(mid).toBeGreaterThan(high)
    }
  })
})

describe('rollMasterySuccess', () => {
  it('dominado nunca falha, mesmo com o pior sorteio', () => {
    expect(rollMasterySuccess(MAX_MASTERY, () => 0.9999)).toBe(true)
  })

  it('domínio baixo falha com sorteio alto e sai com sorteio baixo', () => {
    expect(rollMasterySuccess(0, () => 0.9999)).toBe(false)
    expect(rollMasterySuccess(0, () => 0)).toBe(true)
  })
})

describe('resolveMasteryAfterUse', () => {
  it('sobe a cada uso, e acertar rende mais', () => {
    const missed = resolveMasteryAfterUse(0, false)
    const hit = resolveMasteryAfterUse(0, true)
    expect(missed).toBeGreaterThan(0)
    expect(hit).toBeGreaterThan(missed)
  })

  it('rende menos perto do máximo', () => {
    const lowGain = resolveMasteryAfterUse(0, false)
    const nearTop = MAX_MASTERY * 0.9
    expect(resolveMasteryAfterUse(nearTop, false) - nearTop).toBeLessThan(
      lowGain,
    )
  })

  it('chega no máximo e não passa dele', () => {
    let mastery = 0
    for (let use = 0; use < 10000 && mastery < MAX_MASTERY; use++) {
      mastery = resolveMasteryAfterUse(mastery, false)
    }
    expect(mastery).toBe(MAX_MASTERY)
    expect(resolveMasteryAfterUse(MAX_MASTERY, true)).toBe(MAX_MASTERY)
  })
})
