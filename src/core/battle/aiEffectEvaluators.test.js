import { afterEach, describe, expect, it } from 'vitest'
import { createWorld } from 'koota'
import { GAME_CONFIG } from '../gameConfig'
import { Conditions, StatStages, WildCreature } from '../traits'
import { getCondition, listConditions } from '../data/conditions'
import { listSpecies } from '../data/species'
import { resolveSpeciesTypes } from '../data/types'
import {
  evaluateConditionEffect,
  evaluateEffect,
  evaluateStatStageEffect,
} from './aiEffectEvaluators'

const { STAT_STAGE_VALUE, STAT_STAGE_DECAY, EFFECT_REFRESH_TIME } =
  GAME_CONFIG.AI_ATTACK
const SEED_VALUE = getCondition('leech-seed').ai.value
const BURN_VALUE = getCondition('burn').ai.value

// Alvo já com a condição `id`, com `timeLeft` sobrando.
const withCondition = (id, timeLeft) =>
  Conditions({ list: [{ id, timeLeft, modifiers: {} }] })

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
const SEED = { type: 'condition', condition: 'leech-seed' }
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

describe('evaluateConditionEffect', () => {
  const BURN = { type: 'condition', condition: 'burn', chance: 0.25 }

  it('sem a condição: o valor dela × a chance; com uma ativa: 0, até perto de acabar', () => {
    expect(evaluateConditionEffect(SEED, spawn(), enemy)).toBe(SEED_VALUE)
    expect(evaluateConditionEffect(BURN, spawn(), enemy)).toBe(
      BURN_VALUE * BURN.chance,
    )
    expect(
      evaluateConditionEffect(BURN, spawn(withCondition('burn', 99)), enemy),
    ).toBe(0)
    expect(
      evaluateConditionEffect(
        BURN,
        spawn(withCondition('burn', EFFECT_REFRESH_TIME - 0.5)),
        enemy,
      ),
    ).toBe(BURN_VALUE * BURN.chance)
  })

  it('outra condição ativa não conta', () => {
    const seeded = spawn(withCondition('leech-seed', 99))
    expect(evaluateConditionEffect(BURN, seeded, enemy)).toBe(
      BURN_VALUE * BURN.chance,
    )
  })

  it('0 em quem usou e em tipo imune', () => {
    expect(evaluateConditionEffect(BURN, spawn(), self)).toBe(0)
    const immuneTypes = getCondition('burn').immuneTypes
    const immune = listSpecies().find((species) =>
      resolveSpeciesTypes(species).some((type) => immuneTypes.includes(type)),
    )
    if (!immune) return
    expect(
      evaluateConditionEffect(
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
    expect(evaluateEffect(SEED, target, enemy)).toBe(SEED_VALUE)
    expect(evaluateEffect({ type: 'desconhecido' }, target, enemy)).toBe(0)
  })
})

describe('evaluateConditionEffect — condição boa', () => {
  // A condição boa do registro (ex.: Focado) e uma ruim (a queimadura).
  const good = listConditions().find((condition) => condition.beneficial)
  const GOOD = { type: 'condition', condition: good.id }
  const BAD = { type: 'condition', condition: 'burn' }

  it('vale em quem usa (aliado), não no inimigo; a ruim, o contrário', () => {
    expect(evaluateConditionEffect(GOOD, spawn(), self)).toBe(good.ai.value)
    expect(evaluateConditionEffect(GOOD, spawn(), enemy)).toBe(0)
    expect(evaluateConditionEffect(BAD, spawn(), self)).toBe(0)
  })

  it('com ela ativa, não vale de novo até perto de acabar', () => {
    expect(
      evaluateConditionEffect(GOOD, spawn(withCondition(good.id, 99)), self),
    ).toBe(0)
  })
})

describe('evaluateRemoveConditionsEffect — soltar de condições', () => {
  const REMOVE = { type: 'removeConditions', conditions: ['leech-seed'] }

  it('em quem usa, vale a condição que ele tem agora', () => {
    expect(
      evaluateEffect(REMOVE, spawn(withCondition('leech-seed', 5)), self),
    ).toBe(SEED_VALUE)
  })

  it('sem a condição, ou no inimigo, não vale nada', () => {
    expect(evaluateEffect(REMOVE, spawn(), self)).toBe(0)
    expect(
      evaluateEffect(REMOVE, spawn(withCondition('leech-seed', 5)), enemy),
    ).toBe(0)
  })
})
