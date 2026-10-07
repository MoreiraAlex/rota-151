import { afterEach, describe, expect, it } from 'vitest'
import { createWorld } from 'koota'
import { GAME_CONFIG } from '../gameConfig'
import { Burn, LeechSeed, StatStages, WildCreature } from '../traits'
import { listSpecies } from '../data/species'
import { resolveSpeciesTypes } from '../data/types'
import {
  evaluateBurnEffect,
  evaluateEffect,
  evaluateLeechSeedEffect,
  evaluateStatStageEffect,
} from './aiEffectEvaluators'

const {
  STAT_STAGE_VALUE,
  STAT_STAGE_DECAY,
  LEECH_SEED_VALUE,
  BURN_VALUE,
  EFFECT_REFRESH_TIME,
} = GAME_CONFIG.AI_ATTACK

const worlds = []
afterEach(() => {
  while (worlds.length) worlds.pop().destroy()
})

function spawn(...traits) {
  const world = createWorld()
  worlds.push(world)
  return world.spawn(...traits)
}

const GROWL = { type: 'statStage', stat: 'attack', stages: -1, duration: 60 }
const GROWTH = { type: 'statStage', stat: 'attack', stages: 1, duration: 60 }
const SEED = { type: 'leechSeed', fraction: 1 / 16, interval: 2, duration: 6 }
const enemy = { ally: false }
const self = { ally: true }

describe('evaluateStatStageEffect', () => {
  it('estágio em 0: vale cheio (baixar o do inimigo, subir o próprio)', () => {
    const target = spawn()
    expect(evaluateStatStageEffect(GROWL, target, enemy)).toBe(STAT_STAGE_VALUE)
    expect(evaluateStatStageEffect(GROWTH, target, self)).toBe(STAT_STAGE_VALUE)
  })

  it('sentido errado vale 0 (subir o do inimigo, baixar o próprio)', () => {
    const target = spawn()
    expect(evaluateStatStageEffect(GROWTH, target, enemy)).toBe(0)
    expect(evaluateStatStageEffect(GROWL, target, self)).toBe(0)
  })

  it('acumula com valor decrescente a cada estágio já aplicado', () => {
    const target = spawn(StatStages({ attackStage: -2, attackTime: 30 }))
    expect(evaluateStatStageEffect(GROWL, target, enemy)).toBeCloseTo(
      STAT_STAGE_VALUE * STAT_STAGE_DECAY ** 2,
    )
  })

  it('estágio no sentido contrário não reduz o valor', () => {
    const target = spawn(StatStages({ attackStage: 2, attackTime: 30 }))
    expect(evaluateStatStageEffect(GROWL, target, enemy)).toBe(STAT_STAGE_VALUE)
  })

  it('no limite (-6) vale 0', () => {
    const target = spawn(StatStages({ attackStage: -6, attackTime: 30 }))
    expect(evaluateStatStageEffect(GROWL, target, enemy)).toBe(0)
  })

  it('perto de expirar volta a valer cheio (renovar), mesmo no limite', () => {
    const target = spawn(
      StatStages({ attackStage: -6, attackTime: EFFECT_REFRESH_TIME - 0.5 }),
    )
    expect(evaluateStatStageEffect(GROWL, target, enemy)).toBe(STAT_STAGE_VALUE)
  })

  it('efeito de mais de um estágio vale por estágio que ainda cabe', () => {
    const target = spawn(StatStages({ attackStage: -5, attackTime: 30 }))
    const screech = { ...GROWL, stages: -2 }
    expect(evaluateStatStageEffect(screech, target, enemy)).toBeCloseTo(
      STAT_STAGE_VALUE * 1 * STAT_STAGE_DECAY ** 5,
    )
  })
})

describe('evaluateLeechSeedEffect', () => {
  it('sem semente: vale cheio; com uma ativa: 0', () => {
    expect(evaluateLeechSeedEffect(SEED, spawn(), enemy)).toBe(LEECH_SEED_VALUE)
    const seeded = spawn(LeechSeed({ timeLeft: 5 }))
    expect(evaluateLeechSeedEffect(SEED, seeded, enemy)).toBe(0)
  })

  it('semente perto de secar volta a valer (replantar)', () => {
    const seeded = spawn(LeechSeed({ timeLeft: EFFECT_REFRESH_TIME - 0.5 }))
    expect(evaluateLeechSeedEffect(SEED, seeded, enemy)).toBe(LEECH_SEED_VALUE)
  })

  it('nunca em quem usou', () => {
    expect(evaluateLeechSeedEffect(SEED, spawn(), self)).toBe(0)
  })
})

describe('evaluateBurnEffect', () => {
  const BURN = { type: 'burn', chance: 0.25, immuneTypes: ['fire'] }

  it('sem queimadura: o valor × a chance; queimado: 0, até perto de apagar', () => {
    expect(evaluateBurnEffect(BURN, spawn(), enemy)).toBe(
      BURN_VALUE * BURN.chance,
    )
    expect(evaluateBurnEffect(BURN, spawn(Burn({ timeLeft: 99 })), enemy)).toBe(
      0,
    )
    expect(
      evaluateBurnEffect(
        BURN,
        spawn(Burn({ timeLeft: EFFECT_REFRESH_TIME - 0.5 })),
        enemy,
      ),
    ).toBe(BURN_VALUE * BURN.chance)
  })

  it('0 em quem usou e em tipo imune', () => {
    expect(evaluateBurnEffect(BURN, spawn(), self)).toBe(0)
    const immune = listSpecies().find((species) =>
      resolveSpeciesTypes(species).includes(BURN.immuneTypes[0]),
    )
    if (!immune) return
    expect(
      evaluateBurnEffect(
        BURN,
        spawn(WildCreature({ speciesId: immune.id })),
        enemy,
      ),
    ).toBe(0)
  })
})

describe('evaluateEffect — registro por tipo de efeito', () => {
  it('despacha pelo `type`; tipo sem avaliador vale 0', () => {
    const target = spawn()
    expect(evaluateEffect(GROWL, target, enemy)).toBe(STAT_STAGE_VALUE)
    expect(evaluateEffect(SEED, target, enemy)).toBe(LEECH_SEED_VALUE)
    expect(evaluateEffect({ type: 'desconhecido' }, target, enemy)).toBe(0)
  })
})
