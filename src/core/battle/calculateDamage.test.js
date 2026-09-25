import { describe, expect, it } from 'vitest'
import { createRng } from '../rng'
import {
  calculateDamage,
  resolveCombatStats,
  resolveDamageAmount,
  resolveStab,
  resolveTypeEffectivenessMultiplier,
  rollCriticalMultiplier,
  rollDamageRandomFactor,
} from './calculateDamage'

describe('calculateDamage', () => {
  it('aplica exatamente a fórmula pedida, sem modificadores', () => {
    // (((((2*10*1)/5 + 2) * 40 * 50) / 50) / 50 + 2) * 1 = 6.8
    expect(
      calculateDamage({ level: 10, attack: 50, defense: 50, power: 40 }),
    ).toBeCloseTo(6.8, 5)
  })

  it('dobra o dano com critical=2', () => {
    const crit = calculateDamage({
      level: 10,
      attack: 50,
      defense: 50,
      power: 40,
      critical: 2,
    })
    // critical entra dentro do termo (2*level*critical)/5, não é um
    // multiplicador final simples — confere o valor exato, não só "maior".
    expect(crit).toBeCloseTo(
      ((((2 * 10 * 2) / 5 + 2) * 40 * 50) / 50 / 50 + 2) * 1,
      5,
    )
  })

  it('aplica stab/type1/type2/random como multiplicadores finais', () => {
    const base = calculateDamage({ level: 10, attack: 50, defense: 50 })
    const withMods = calculateDamage({
      level: 10,
      attack: 50,
      defense: 50,
      stab: 1.5,
      type1: 2,
      type2: 0.5,
      random: 0.9,
    })
    expect(withMods).toBeCloseTo(base * 1.5 * 2 * 0.5 * 0.9, 5)
  })

  it('usa power=1 quando omitido', () => {
    expect(calculateDamage({ level: 5, attack: 50, defense: 50 })).toBe(
      calculateDamage({ level: 5, attack: 50, defense: 50, power: 1 }),
    )
  })
})

describe('rollCriticalMultiplier', () => {
  it('devolve 1 quando o sorteio fica acima da chance configurada', () => {
    expect(rollCriticalMultiplier(() => 0.9999)).toBe(1)
  })

  it('devolve 2 quando o sorteio fica abaixo da chance configurada', () => {
    expect(rollCriticalMultiplier(() => 0)).toBe(2)
  })
})

describe('rollDamageRandomFactor', () => {
  it('fica dentro da faixa configurada (0.85-1)', () => {
    const rng = createRng(1)
    for (let i = 0; i < 50; i++) {
      const value = rollDamageRandomFactor(rng)
      expect(value).toBeGreaterThanOrEqual(0.85)
      expect(value).toBeLessThanOrEqual(1)
    }
  })

  it('extremos do rng batem com min/max configurados', () => {
    expect(rollDamageRandomFactor(() => 0)).toBeCloseTo(0.85, 5)
    expect(rollDamageRandomFactor(() => 1)).toBeCloseTo(1, 5)
  })
})

describe('resolveStab', () => {
  it('devolve 1 sem tipo de ataque ou sem tipos do atacante', () => {
    expect(resolveStab(null, ['fire'])).toBe(1)
    expect(resolveStab('fire', null)).toBe(1)
  })

  it('devolve 1.5 quando o tipo do ataque é um dos tipos do atacante', () => {
    expect(resolveStab('fire', ['fire', 'flying'])).toBe(1.5)
  })

  it('devolve 1 quando o tipo do ataque não é do atacante', () => {
    expect(resolveStab('water', ['fire', 'flying'])).toBe(1)
  })
})

describe('resolveTypeEffectivenessMultiplier', () => {
  it('é sempre neutro (1) — tabela de tipos ainda não existe', () => {
    expect(resolveTypeEffectivenessMultiplier('fire', 'grass')).toBe(1)
    expect(resolveTypeEffectivenessMultiplier(null, null)).toBe(1)
  })
})

describe('resolveCombatStats', () => {
  it('usa o fallback pra espécie sem stats migrados (stats: {})', () => {
    const species = { level: 3, stats: {} }
    expect(resolveCombatStats(species, null)).toEqual({
      level: 3,
      attack: 50,
      defense: 50,
      sp_atk: 50,
      sp_def: 50,
    })
  })

  it('usa o stat de verdade pra espécie migrada', () => {
    const species = {
      level: 5,
      stats: {
        hp: { base: 45, ev: 0 },
        attack: { base: 49, ev: 0 },
        defense: { base: 49, ev: 0 },
        sp_atk: { base: 65, ev: 0 },
        sp_def: { base: 65, ev: 0 },
        speed: { base: 45, ev: 0 },
      },
    }
    const individualValues = {
      hp: 0,
      attack: 0,
      defense: 0,
      sp_atk: 0,
      sp_def: 0,
      speed: 0,
    }
    const resolved = resolveCombatStats(species, individualValues)
    expect(resolved.level).toBe(5)
    expect(resolved.attack).toBeGreaterThan(0)
    expect(resolved.attack).not.toBe(50)
  })
})

describe('resolveDamageAmount', () => {
  const attackerSpecies = {
    level: 5,
    types: ['grass'],
    stats: {
      hp: { base: 45 },
      attack: { base: 49 },
      defense: { base: 49 },
      sp_atk: { base: 65 },
      sp_def: { base: 65 },
      speed: { base: 45 },
    },
  }
  const defenderSpecies = {
    level: 5,
    stats: {
      hp: { base: 39 },
      attack: { base: 52 },
      defense: { base: 43 },
      sp_atk: { base: 60 },
      sp_def: { base: 50 },
      speed: { base: 65 },
    },
  }
  const zeroIv = {
    hp: 0,
    attack: 0,
    defense: 0,
    sp_atk: 0,
    sp_def: 0,
    speed: 0,
  }

  it('usa attack/defense pra categoria physical', () => {
    const rng = () => 1 // sem crítico, random no teto (1)
    const physical = resolveDamageAmount({
      attackerSpecies,
      attackerIndividualValues: zeroIv,
      defenderSpecies,
      defenderIndividualValues: zeroIv,
      damage: { power: 45, category: 'physical', type: 'grass' },
      rng,
    })
    const special = resolveDamageAmount({
      attackerSpecies,
      attackerIndividualValues: zeroIv,
      defenderSpecies,
      defenderIndividualValues: zeroIv,
      damage: { power: 45, category: 'special', type: 'grass' },
      rng,
    })
    // sp_atk (65) do atacante é maior que attack (49), e sp_def (50) do
    // defensor é menor que defense (43) é maior — resultado diferente,
    // confirma que a categoria realmente troca o par de stats usado.
    expect(physical.amount).not.toBeCloseTo(special.amount, 5)
  })

  it('aplica STAB quando o tipo do ataque bate com o do atacante', () => {
    const rng = () => 1
    const withStab = resolveDamageAmount({
      attackerSpecies,
      attackerIndividualValues: zeroIv,
      defenderSpecies,
      defenderIndividualValues: zeroIv,
      damage: { power: 45, category: 'physical', type: 'grass' },
      rng,
    })
    const withoutStab = resolveDamageAmount({
      attackerSpecies,
      attackerIndividualValues: zeroIv,
      defenderSpecies,
      defenderIndividualValues: zeroIv,
      damage: { power: 45, category: 'physical', type: 'water' },
      rng,
    })
    expect(withStab.amount).toBeCloseTo(withoutStab.amount * 1.5, 5)
  })

  it('informa se o crítico saiu, e o crítico aumenta o dano', () => {
    const args = {
      attackerSpecies,
      attackerIndividualValues: zeroIv,
      defenderSpecies,
      defenderIndividualValues: zeroIv,
      damage: { power: 45, category: 'physical', type: null },
    }
    // rng 0 → abaixo da chance de crítico; random no piso (0.85).
    const crit = resolveDamageAmount({ ...args, rng: () => 0 })
    // rng ~1 → sem crítico; random quase no teto.
    const normal = resolveDamageAmount({ ...args, rng: () => 0.9999 })

    expect(crit.critical).toBe(true)
    expect(normal.critical).toBe(false)
    expect(crit.amount).toBeGreaterThan(normal.amount)
  })
})
