import { describe, it, expect } from 'vitest'
import { createRng } from '../../rng'
import {
  calculateHpStat,
  calculateStat,
  resolveCreatureStats,
  rollIndividualValues,
} from './stats'

const STAT_KEYS = ['hp', 'attack', 'defense', 'sp_atk', 'sp_def', 'speed']

const REFERENCE_IV = {
  hp: 20,
  attack: 20,
  defense: 20,
  sp_atk: 20,
  sp_def: 20,
  speed: 20,
}

function fakeSpecies(overrides = {}) {
  return {
    level: 5,
    stats: {
      hp: { base: 45, ev: 0, regenPercent: 2, regenDelay: 5 },
      attack: { base: 49, ev: 0 },
      defense: { base: 49, ev: 0 },
      sp_atk: { base: 65, ev: 0 },
      sp_def: { base: 65, ev: 0 },
      speed: { base: 45, ev: 0 },
      energy: { regenPercent: 10, regenDelay: 3 },
    },
    ...overrides,
  }
}

describe('rollIndividualValues', () => {
  it('sorteia os seis status dentro de [min, max]', () => {
    const rng = createRng(151)
    const values = rollIndividualValues(rng, { min: 0, max: 31 })

    for (const key of STAT_KEYS) {
      expect(values[key]).toBeGreaterThanOrEqual(0)
      expect(values[key]).toBeLessThanOrEqual(31)
    }
  })

  it('mesmo rng (mesmo estado) sorteia sequências diferentes em chamadas seguidas', () => {
    const rng = createRng(151)
    const first = rollIndividualValues(rng, { min: 0, max: 31 })
    const second = rollIndividualValues(rng, { min: 0, max: 31 })

    expect(first).not.toEqual(second)
  })
})

describe('resolveCreatureStats', () => {
  it('usa o individualValues passado — cada indivíduo com seu próprio resultado', () => {
    const species = fakeSpecies()
    const lowIvHp = calculateHpStat({ base: 45, iv: 0, ev: 0, level: 5 })
    const highIvHp = calculateHpStat({ base: 45, iv: 31, ev: 0, level: 5 })

    const weak = resolveCreatureStats(species, { ...REFERENCE_IV, hp: 0 })
    const strong = resolveCreatureStats(species, { ...REFERENCE_IV, hp: 31 })

    expect(weak.hp.stat).toBe(lowIvHp)
    expect(strong.hp.stat).toBe(highIvHp)
    expect(weak.hp.stat).not.toBe(strong.hp.stat)
  })

  it('sem individualValues, todo iv cai em 0', () => {
    const species = fakeSpecies()
    const resolved = resolveCreatureStats(species, null)

    for (const key of STAT_KEYS) {
      expect(resolved[key].iv).toBe(0)
    }
  })

  it('energy deriva de hp/defense/sp_def já recalculados, não da espécie', () => {
    const species = fakeSpecies()
    const individualValues = {
      hp: 31,
      attack: 0,
      defense: 31,
      sp_atk: 0,
      sp_def: 31,
      speed: 0,
    }
    const resolved = resolveCreatureStats(species, individualValues)

    const expectedEnergy = Math.trunc(
      (resolved.hp.stat + resolved.defense.stat + resolved.sp_def.stat) / 3,
    )
    expect(resolved.energy.stat).toBe(expectedEnergy)
  })

  it('cp sai calculado quando os seis status estão presentes', () => {
    const species = fakeSpecies()
    const resolved = resolveCreatureStats(species, REFERENCE_IV)
    expect(typeof resolved.cp).toBe('number')
  })

  it('espécie sem base (ex.: treinador) retorna null', () => {
    const species = { stats: { hp: { stat: 100 } } }
    expect(resolveCreatureStats(species, {})).toBeNull()
  })

  it('espécie sem stats nenhum (ex.: fox/wolf ainda não migrados) retorna null', () => {
    expect(resolveCreatureStats({ stats: {} }, {})).toBeNull()
  })
})

describe('calculateStat (referência pra checagem cruzada)', () => {
  it('bate com a fórmula clássica', () => {
    expect(calculateStat({ base: 49, iv: 31, ev: 0, level: 5 })).toBe(
      Math.trunc((Math.trunc(((2 * 49 + 31) * 5) / 100) + 5) * 1),
    )
  })
})
