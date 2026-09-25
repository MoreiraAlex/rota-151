import { describe, it, expect } from 'vitest'
import {
  applyDamage,
  applyHeal,
  resolveMaxHp,
  vitalsFromSpecies,
} from './vitals'

// `stat` aqui simula o valor pré-calculado que um arquivo de espécie de
// verdade guarda (`core/data/species/stats.js`, `calculateHpStat` etc.,
// rodado uma vez no module load com o `iv` literal) — é o fallback que
// `resolveMaxHp` usa quando NENHUM `individualValues` é passado.
function fakeSpecies() {
  return {
    level: 5,
    stats: {
      hp: { base: 45, ev: 0, stat: 69, regenPercent: 2, regenDelay: 5 },
      attack: { base: 49, ev: 0 },
      defense: { base: 49, ev: 0 },
      sp_atk: { base: 65, ev: 0 },
      sp_def: { base: 65, ev: 0 },
      speed: { base: 45, ev: 0 },
      energy: { regenPercent: 10, regenDelay: 3 },
    },
  }
}

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

describe('resolveMaxHp com individualValues', () => {
  it('sem individualValues, usa o stat de referência da espécie', () => {
    const species = fakeSpecies()
    expect(resolveMaxHp(species)).toBe(species.stats.hp.stat)
  })

  it('com individualValues, recalcula a partir do IV da entidade — não da espécie', () => {
    const species = fakeSpecies()
    const lowIv = resolveMaxHp(species, {
      hp: 0,
      attack: 20,
      defense: 20,
      sp_atk: 20,
      sp_def: 20,
      speed: 20,
    })
    const highIv = resolveMaxHp(species, {
      hp: 31,
      attack: 20,
      defense: 20,
      sp_atk: 20,
      sp_def: 20,
      speed: 20,
    })

    expect(lowIv).not.toBe(highIv)
    expect(lowIv).toBeLessThan(highIv)
  })
})

describe('vitalsFromSpecies com individualValues', () => {
  it('duas criaturas da mesma espécie com IV diferente nascem com hp máximo diferente', () => {
    const species = fakeSpecies()
    // `Vitals({...})` (trait do koota) retorna a tupla interna
    // `[factory, overrides]` usada por `world.spawn` — os valores de
    // verdade ficam no segundo elemento, não direto no retorno.
    const [, weak] = vitalsFromSpecies(species, {
      hp: 0,
      attack: 0,
      defense: 0,
      sp_atk: 0,
      sp_def: 0,
      speed: 0,
    })
    const [, strong] = vitalsFromSpecies(species, {
      hp: 31,
      attack: 31,
      defense: 31,
      sp_atk: 31,
      sp_def: 31,
      speed: 31,
    })

    expect(weak.maxHp).toBeLessThan(strong.maxHp)
    expect(weak.maxStamina).toBeLessThan(strong.maxStamina)
  })
})
