import { afterEach, describe, expect, it } from 'vitest'
import { createWorld } from 'koota'
import { StatStages } from '@/core/traits'
import {
  STAT_STAGE_LIMIT,
  applyStatStageEffect,
  clampStage,
  listActiveStatStages,
  readStatStages,
  stageMultiplier,
  accuracyMultiplier,
} from './statStages'

describe('stageMultiplier — a fórmula de estágios do Pokémon', () => {
  it('positivo: (2 + n) / 2; negativo: 2 / (2 - n); zero: 1', () => {
    expect(stageMultiplier(0)).toBe(1)
    expect(stageMultiplier(1)).toBeCloseTo(3 / 2)
    expect(stageMultiplier(2)).toBe(2)
    expect(stageMultiplier(6)).toBe(4)
    expect(stageMultiplier(-1)).toBeCloseTo(2 / 3)
    expect(stageMultiplier(-2)).toBe(1 / 2)
    expect(stageMultiplier(-6)).toBe(1 / 4)
  })
})

describe('clampStage', () => {
  it('limita a -6..+6', () => {
    expect(STAT_STAGE_LIMIT).toBe(6)
    expect(clampStage(9)).toBe(6)
    expect(clampStage(-9)).toBe(-6)
    expect(clampStage(3)).toBe(3)
  })
})

describe('applyStatStageEffect / readStatStages', () => {
  const worlds = []
  afterEach(() => {
    while (worlds.length) worlds.pop().destroy()
  })
  function spawn() {
    const world = createWorld()
    worlds.push(world)
    return world.spawn()
  }
  const growl = { type: 'statStage', stat: 'attack', stages: -1, duration: 15 }

  it('criatura sem o trait lê zeros', () => {
    expect(readStatStages(spawn())).toEqual({
      attack: 0,
      defense: 0,
      sp_atk: 0,
      sp_def: 0,
      accuracy: 0,
    })
  })

  it('o primeiro efeito adiciona o trait, baixa o estágio e dá o tempo', () => {
    const entity = spawn()
    expect(entity.has(StatStages)).toBe(false)

    const change = applyStatStageEffect(entity, growl)

    expect(change).toEqual({ stat: 'attack', delta: -1, stage: -1 })
    expect(entity.has(StatStages)).toBe(true)
    expect(entity.get(StatStages).attackStage).toBe(-1)
    expect(entity.get(StatStages).attackTime).toBe(15)
    expect(readStatStages(entity).attack).toBe(-1)
  })

  it('usar de novo ACUMULA o estágio e RENOVA o tempo', () => {
    const entity = spawn()
    applyStatStageEffect(entity, growl)
    entity.set(StatStages, { attackTime: 4 }) // passou o tempo

    const change = applyStatStageEffect(entity, growl)

    expect(change.stage).toBe(-2)
    expect(entity.get(StatStages).attackTime).toBe(15)
  })

  it('para no limite de -6: delta 0 ao já estar lá, mas o tempo ainda renova', () => {
    const entity = spawn()
    for (let i = 0; i < 6; i++) applyStatStageEffect(entity, growl)
    expect(entity.get(StatStages).attackStage).toBe(-6)
    entity.set(StatStages, { attackTime: 3 })

    const change = applyStatStageEffect(entity, growl)

    expect(change.delta).toBe(0)
    expect(change.stage).toBe(-6)
    expect(entity.get(StatStages).attackTime).toBe(15)
  })

  it('um passo grande não passa do limite (delta = o que coube)', () => {
    const entity = spawn()
    applyStatStageEffect(entity, { ...growl, stages: -5 })

    const change = applyStatStageEffect(entity, { ...growl, stages: -4 })

    expect(change).toEqual({ stat: 'attack', delta: -1, stage: -6 })
  })

  it('cada atributo tem o seu estágio e o seu tempo, independentes', () => {
    const entity = spawn()
    applyStatStageEffect(entity, growl)
    applyStatStageEffect(entity, {
      type: 'statStage',
      stat: 'defense',
      stages: 2,
      duration: 8,
    })

    expect(readStatStages(entity)).toEqual({
      attack: -1,
      defense: 2,
      sp_atk: 0,
      sp_def: 0,
      accuracy: 0,
    })
    expect(entity.get(StatStages).attackTime).toBe(15)
    expect(entity.get(StatStages).defenseTime).toBe(8)
  })

  it('voltar a 0 não deixa tempo sobrando', () => {
    const entity = spawn()
    applyStatStageEffect(entity, growl)

    applyStatStageEffect(entity, { ...growl, stages: 1 })

    expect(entity.get(StatStages).attackStage).toBe(0)
    expect(entity.get(StatStages).attackTime).toBe(0)
  })

  it('efeito de outro tipo ou atributo desconhecido é ignorado (null, nada muda)', () => {
    const entity = spawn()

    expect(applyStatStageEffect(entity, { type: 'burn' })).toBeNull()
    expect(
      applyStatStageEffect(entity, {
        type: 'statStage',
        stat: 'speed',
        stages: -1,
      }),
    ).toBeNull()
    expect(applyStatStageEffect(entity, undefined)).toBeNull()
    expect(entity.has(StatStages)).toBe(false)
  })
})

describe('listActiveStatStages', () => {
  const worlds = []
  afterEach(() => {
    while (worlds.length) worlds.pop().destroy()
  })

  it('só lista atributos alterados (estágio diferente de zero)', () => {
    const world = createWorld()
    worlds.push(world)
    const entity = world.spawn()
    expect(listActiveStatStages(entity)).toEqual([])

    applyStatStageEffect(entity, {
      type: 'statStage',
      stat: 'attack',
      stages: -2,
      duration: 15,
    })
    applyStatStageEffect(entity, {
      type: 'statStage',
      stat: 'defense',
      stages: 1,
      duration: 15,
    })

    expect(listActiveStatStages(entity)).toEqual([
      { stat: 'attack', stage: -2 },
      { stat: 'defense', stage: 1 },
    ])
  })
})

describe('accuracyMultiplier — a fórmula de precisão do Pokémon', () => {
  it('3/(3-n) pra estágio negativo e (3+n)/3 pra positivo', () => {
    expect(accuracyMultiplier(0)).toBe(1)
    expect(accuracyMultiplier(-1)).toBeCloseTo(3 / 4)
    expect(accuracyMultiplier(-2)).toBeCloseTo(3 / 5)
    expect(accuracyMultiplier(-6)).toBeCloseTo(1 / 3)
    expect(accuracyMultiplier(1)).toBeCloseTo(4 / 3)
    expect(accuracyMultiplier(6)).toBe(3)
  })

  it('a precisão é um atributo com estágio: o efeito statStage aceita `accuracy`', () => {
    const world = createWorld()
    const entity = world.spawn()
    const change = applyStatStageEffect(entity, {
      type: 'statStage',
      stat: 'accuracy',
      stages: -1,
      duration: 30,
    })
    expect(change).toEqual({ stat: 'accuracy', delta: -1, stage: -1 })
    expect(readStatStages(entity).accuracy).toBe(-1)
    expect(listActiveStatStages(entity)).toEqual([
      { stat: 'accuracy', stage: -1 },
    ])
    world.destroy()
  })
})
