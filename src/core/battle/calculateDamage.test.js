import { describe, expect, it } from 'vitest'
import { resolveFormulaLevel } from '../data/species/formulaLevel'
import { createRng } from '../rng'
import { getSpecies } from '../data/species'
import { GAME_CONFIG } from '../gameConfig'
import { TYPE_CHART } from '../data/types'
import {
  calculateDamage,
  resolveChannelTickDamage,
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

  it('devolve o STAB da config quando o tipo do ataque é um dos tipos do atacante', () => {
    expect(resolveStab('fire', ['fire', 'flying'])).toBe(
      GAME_CONFIG.TYPES.STAB_MULTIPLIER,
    )
  })

  it('devolve 1 quando o tipo do ataque não é do atacante', () => {
    expect(resolveStab('water', ['fire', 'flying'])).toBe(1)
  })
})

describe('resolveTypeEffectivenessMultiplier', () => {
  it('lê a tabela de tipos', () => {
    expect(resolveTypeEffectivenessMultiplier('fire', 'grass')).toBe(
      TYPE_CHART.fire.grass,
    )
  })

  it('é neutro sem tipo de um dos lados', () => {
    expect(resolveTypeEffectivenessMultiplier(null, 'grass')).toBe(1)
    expect(resolveTypeEffectivenessMultiplier('fire', null)).toBe(1)
  })
})

describe('resolveCombatStats', () => {
  it('usa o fallback pra espécie sem stats migrados (stats: {})', () => {
    const species = { level: 3, stats: {} }
    expect(resolveCombatStats(species, null)).toEqual({
      level: resolveFormulaLevel(3),
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
    expect(resolved.level).toBe(resolveFormulaLevel(5))
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
      damage: { power: 45, category: 'physical' },
      attackType: 'grass',
      rng,
    })
    const special = resolveDamageAmount({
      attackerSpecies,
      attackerIndividualValues: zeroIv,
      defenderSpecies,
      defenderIndividualValues: zeroIv,
      damage: { power: 45, category: 'special' },
      attackType: 'grass',
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
      damage: { power: 45, category: 'physical' },
      attackType: 'grass',
      rng,
    })
    const withoutStab = resolveDamageAmount({
      attackerSpecies,
      attackerIndividualValues: zeroIv,
      defenderSpecies,
      defenderIndividualValues: zeroIv,
      damage: { power: 45, category: 'physical' },
      attackType: 'water',
      rng,
    })
    expect(withStab.amount).toBeCloseTo(
      withoutStab.amount * GAME_CONFIG.TYPES.STAB_MULTIPLIER,
      5,
    )
  })

  it('multiplica pela efetividade de cada tipo do defensor e informa a categoria', () => {
    const args = {
      attackerSpecies: { ...attackerSpecies, types: [] },
      attackerIndividualValues: zeroIv,
      defenderIndividualValues: zeroIv,
      damage: { power: 45, category: 'physical' },
      attackType: 'fire',
      rng: () => 1,
    }
    const neutral = resolveDamageAmount({ ...args, defenderSpecies })
    const dual = resolveDamageAmount({
      ...args,
      defenderSpecies: { ...defenderSpecies, types: ['grass', 'bug'] },
    })
    const expected = TYPE_CHART.fire.grass * TYPE_CHART.fire.bug
    expect(neutral.effectiveness).toBe('neutral')
    expect(dual.amount).toBeCloseTo(neutral.amount * expected, 5)
    expect(dual.effectiveness).toBe('super')
  })

  it('imune: dano zero e efetividade immune', () => {
    const [attackType, defenderType] = Object.entries(TYPE_CHART)
      .flatMap(([attack, row]) =>
        Object.entries(row).map(([defender, value]) => [
          attack,
          defender,
          value,
        ]),
      )
      .find(([, , value]) => value === 0)
    const result = resolveDamageAmount({
      attackerSpecies: { ...attackerSpecies, types: [] },
      attackerIndividualValues: zeroIv,
      defenderSpecies: { ...defenderSpecies, types: [defenderType] },
      defenderIndividualValues: zeroIv,
      damage: { power: 45, category: 'physical' },
      attackType,
      rng: () => 1,
    })
    expect(result.amount).toBe(0)
    expect(result.effectiveness).toBe('immune')
  })

  it('informa se o crítico saiu, e o crítico aumenta o dano', () => {
    const args = {
      attackerSpecies,
      attackerIndividualValues: zeroIv,
      defenderSpecies,
      defenderIndividualValues: zeroIv,
      damage: { power: 45, category: 'physical' },
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

describe('resolveDamageAmount — estágios de atributo (golpes de status)', () => {
  // charmander: espécie de teste estável; rng fixo (sem crítico, fator aleatório médio)
  const species = getSpecies('charmander')
  const rng = () => 0.99
  const dano = (stages = {}) =>
    resolveDamageAmount({
      attackerSpecies: species,
      attackerIndividualValues: null,
      defenderSpecies: species,
      defenderIndividualValues: null,
      damage: { power: 40, category: 'physical' },
      rng,
      ...stages,
    }).amount

  it('sem estágios, o dano é o de sempre', () => {
    expect(dano({ attackerStages: undefined, defenderStages: undefined })).toBe(
      dano({
        attackerStages: { attack: 0, defense: 0, sp_atk: 0, sp_def: 0 },
        defenderStages: { attack: 0, defense: 0, sp_atk: 0, sp_def: 0 },
      }),
    )
  })

  it('o ataque do ATACANTE baixado (-1) causa menos dano', () => {
    const normal = dano()
    const baixado = dano({ attackerStages: { attack: -1 } })

    expect(baixado).toBeLessThan(normal)
  })

  it('ataque em -6 (×1/4) causa bem menos dano que em -1 (×2/3)', () => {
    expect(dano({ attackerStages: { attack: -6 } })).toBeLessThan(
      dano({ attackerStages: { attack: -1 } }),
    )
  })

  it('a DEFESA do alvo baixada (-1) faz o alvo levar mais dano; elevada (+1), menos', () => {
    const normal = dano()
    expect(dano({ defenderStages: { defense: -1 } })).toBeGreaterThan(normal)
    expect(dano({ defenderStages: { defense: 1 } })).toBeLessThan(normal)
  })

  it('golpe FÍSICO ignora os estágios especiais, e o ESPECIAL ignora os físicos', () => {
    const physical = (stages) => dano(stages)
    expect(physical({ attackerStages: { sp_atk: -6 } })).toBe(physical())
    expect(physical({ defenderStages: { sp_def: -6 } })).toBe(physical())

    const special = (stages) =>
      resolveDamageAmount({
        attackerSpecies: species,
        attackerIndividualValues: null,
        defenderSpecies: species,
        defenderIndividualValues: null,
        damage: { power: 40, category: 'special' },
        rng,
        ...stages,
      }).amount
    expect(special({ attackerStages: { attack: -6 } })).toBe(special())
    expect(special({ attackerStages: { sp_atk: -1 } })).toBeLessThan(special())
  })

  it('queimadura corta o ataque FÍSICO de quem ataca, não o especial', () => {
    const multiplier = 0.5
    const physical = (burn) =>
      resolveDamageAmount({
        attackerSpecies: species,
        attackerIndividualValues: null,
        defenderSpecies: species,
        defenderIndividualValues: null,
        damage: { power: 40, category: 'physical' },
        attackerBurnMultiplier: burn,
        rng,
      }).amount
    expect(physical(multiplier)).toBeLessThan(physical(undefined))

    const special = (burn) =>
      resolveDamageAmount({
        attackerSpecies: species,
        attackerIndividualValues: null,
        defenderSpecies: species,
        defenderIndividualValues: null,
        damage: { power: 40, category: 'special' },
        attackerBurnMultiplier: burn,
        rng,
      }).amount
    expect(special(multiplier)).toBe(special(undefined))
  })

  it('o dano de um tick de canal também lê os estágios', () => {
    const tick = (stages) =>
      resolveChannelTickDamage({
        attackerSpecies: species,
        attackerIndividualValues: null,
        defenderSpecies: species,
        defenderIndividualValues: null,
        damage: { power: 40, category: 'physical' },
        weight: 0.5,
        rng,
        ...stages,
      }).amount
    expect(tick({ attackerStages: { attack: -2 } })).toBeLessThan(tick())
  })
})
