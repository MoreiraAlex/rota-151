import { describe, expect, it } from 'vitest'
import { getSpecies } from '../data/species'
import { resolveSkill } from '../data/skills'
import { GAME_CONFIG } from '../gameConfig'
import {
  resolveAttackCooldown,
  resolveAttackWeight,
  resolveLevelCost,
  withActionCost,
} from './actionCost'
import { resolveAttackForEntity, resolveSpeedFactor } from './attackCasting'

const {
  COST_DIVISOR,
  COOLDOWN_PER_WEIGHT,
  RANGED_MIN_RANGE,
  RANGED_BONUS,
  CONE_BONUS,
} = GAME_CONFIG.ACTION_COST
const { STAT_STAGE_VALUE, LEECH_SEED_VALUE } = GAME_CONFIG.AI_ATTACK

const melee = (fields) => ({ range: 1.4, ...fields })

describe('resolveAttackWeight — o "poder" do preço', () => {
  it('golpe de dano corpo a corpo: o próprio poder', () => {
    expect(resolveAttackWeight(melee({ damage: { power: 40 } }))).toBe(40)
  })

  it('efeitos somam o peso deles (a régua da IA)', () => {
    const growl = melee({
      effects: [{ type: 'statStage', stat: 'attack', stages: -1 }],
    })
    const growth = melee({
      effects: [
        { type: 'statStage', stat: 'attack', stages: 1 },
        { type: 'statStage', stat: 'sp_atk', stages: 1 },
      ],
    })
    const seed = melee({ effects: [{ type: 'leechSeed' }] })
    expect(resolveAttackWeight(growl)).toBe(STAT_STAGE_VALUE)
    expect(resolveAttackWeight(growth)).toBe(2 * STAT_STAGE_VALUE)
    expect(resolveAttackWeight(seed)).toBe(LEECH_SEED_VALUE)
  })

  it('tipo de efeito sem peso vale 0', () => {
    expect(resolveAttackWeight(melee({ effects: [{ type: 'nada' }] }))).toBe(0)
  })

  it('à distância (alcance >= RANGED_MIN_RANGE): × RANGED_BONUS', () => {
    const ember = { range: RANGED_MIN_RANGE, damage: { power: 40 } }
    expect(resolveAttackWeight(ember)).toBeCloseTo(40 * RANGED_BONUS)
    const short = { range: RANGED_MIN_RANGE - 0.1, damage: { power: 40 } }
    expect(resolveAttackWeight(short)).toBe(40)
  })

  it('em cone (área ou canal): × CONE_BONUS', () => {
    expect(
      resolveAttackWeight(melee({ area: 'cone', damage: { power: 40 } })),
    ).toBeCloseTo(40 * CONE_BONUS)
    expect(
      resolveAttackWeight(
        melee({ damageMode: 'channel', damage: { power: 40 } }),
      ),
    ).toBeCloseTo(40 * CONE_BONUS)
  })

  it('golpe em si mesmo não conta alcance', () => {
    const self = {
      area: 'self',
      range: 99,
      effects: [{ type: 'statStage', stages: 1 }],
    }
    expect(resolveAttackWeight(self)).toBe(STAT_STAGE_VALUE)
  })
})

describe('custo e recarga pela fórmula', () => {
  it('custo = (2·nível/5 + 2) × peso / COST_DIVISOR — cresce com o nível', () => {
    expect(resolveLevelCost(5, 40)).toBeCloseTo((4 * 40) / COST_DIVISOR)
    expect(resolveLevelCost(50, 40)).toBeCloseTo((22 * 40) / COST_DIVISOR)
    expect(resolveLevelCost(50, 40)).toBeGreaterThan(resolveLevelCost(5, 40))
  })

  it('recarga = peso × COOLDOWN_PER_WEIGHT × fator de velocidade', () => {
    expect(resolveAttackCooldown(40)).toBeCloseTo(40 * COOLDOWN_PER_WEIGHT)
    expect(resolveAttackCooldown(40, 0.5)).toBeCloseTo(
      40 * COOLDOWN_PER_WEIGHT * 0.5,
    )
  })

  it('withActionCost: ausentes saem da fórmula; o básico não tem recarga', () => {
    const tackle = melee({ damage: { power: 40 } })
    const skill = withActionCost(tackle, { slot: 'secondary1', level: 5 })
    expect(skill.staminaCost).toBeCloseTo(resolveLevelCost(5, 40))
    expect(skill.cooldown).toBeCloseTo(resolveAttackCooldown(40))

    const basic = withActionCost(tackle, { slot: 'primary', level: 5 })
    expect(basic.staminaCost).toBeCloseTo(resolveLevelCost(5, 40))
    expect(basic.cooldown).toBe(0)
  })

  it('withActionCost: escrito na definição (skill ou override) ganha da fórmula', () => {
    const custom = melee({ damage: { power: 40 }, staminaCost: 9, cooldown: 7 })
    const resolved = withActionCost(custom, { slot: 'secondary1', level: 5 })
    expect(resolved.staminaCost).toBe(9)
    expect(resolved.cooldown).toBe(7)
  })
})

describe('resolveAttackForEntity — o golpe de verdade, com o preço', () => {
  const CHARMANDER = getSpecies('charmander')
  const IVS = {
    hp: 15,
    attack: 15,
    defense: 15,
    sp_atk: 15,
    sp_def: 15,
    speed: 15,
  }

  it('as skills da espécie saem com custo e recarga da fórmula, pelo nível e pelo speed', () => {
    const speedFactor = resolveSpeedFactor(CHARMANDER, IVS)
    for (const slot of ['secondary1', 'secondary2', 'secondary3']) {
      const attack = resolveAttackForEntity(CHARMANDER, slot, IVS)
      const weight = resolveAttackWeight(attack)
      expect(weight).toBeGreaterThan(0)
      expect(attack.staminaCost).toBeCloseTo(
        resolveLevelCost(CHARMANDER.level, weight),
      )
      expect(attack.cooldown).toBeCloseTo(
        resolveAttackCooldown(weight, speedFactor),
      )
    }
  })

  it('mesmo poder: à distância custa mais que corpo a corpo (Ember × Tackle)', () => {
    const ember = withActionCost(resolveSkill('ember'), {
      slot: 'secondary1',
      level: 5,
    })
    const tackle = withActionCost(resolveSkill('tackle'), {
      slot: 'secondary1',
      level: 5,
    })
    expect(ember.damage.power).toBe(tackle.damage.power)
    expect(ember.staminaCost).toBeGreaterThan(tackle.staminaCost)
  })

  it('o básico tem custo simbólico e nenhuma recarga', () => {
    const basic = resolveAttackForEntity(CHARMANDER, 'primary', IVS)
    const tackle = resolveAttackForEntity(CHARMANDER, 'secondary2', IVS)
    expect(basic.staminaCost).toBeGreaterThan(0)
    expect(basic.staminaCost).toBeLessThan(tackle.staminaCost / 4)
    expect(basic.cooldown).toBe(0)
  })
})
