import { afterEach, describe, expect, it } from 'vitest'
import { createWorld } from 'koota'
import { Fainted, StatStages } from '@/core/traits'
import { statStageSystem } from './statStageSystem'

const worlds = []
afterEach(() => {
  while (worlds.length) worlds.pop().destroy()
})
function spawn(stages) {
  const world = createWorld()
  worlds.push(world)
  return { world, entity: world.spawn(StatStages(stages)) }
}

describe('statStageSystem', () => {
  it('conta o tempo do atributo com estágio pra baixo', () => {
    const { world, entity } = spawn({ attackStage: -1, attackTime: 15 })

    statStageSystem({ world, delta: 5 })

    expect(entity.get(StatStages).attackTime).toBeCloseTo(10)
    expect(entity.get(StatStages).attackStage).toBe(-1)
  })

  it('o tempo zerou: o estágio volta a 0 (e o tempo também)', () => {
    const { world, entity } = spawn({ attackStage: -2, attackTime: 1 })

    statStageSystem({ world, delta: 1 })

    expect(entity.get(StatStages).attackStage).toBe(0)
    expect(entity.get(StatStages).attackTime).toBe(0)
  })

  it('cada atributo expira no seu tempo, sem afetar os outros', () => {
    const { world, entity } = spawn({
      attackStage: -1,
      attackTime: 1,
      defenseStage: 2,
      defenseTime: 10,
    })

    statStageSystem({ world, delta: 2 })

    expect(entity.get(StatStages).attackStage).toBe(0)
    expect(entity.get(StatStages).defenseStage).toBe(2)
    expect(entity.get(StatStages).defenseTime).toBeCloseTo(8)
  })

  it('atributo sem estágio não tem tempo contando (não fica negativo)', () => {
    const { world, entity } = spawn({ attackStage: 0, attackTime: 0 })

    statStageSystem({ world, delta: 3 })

    expect(entity.get(StatStages).attackTime).toBe(0)
  })

  it('renovar o tempo (usar de novo) adia a expiração', () => {
    const { world, entity } = spawn({ attackStage: -1, attackTime: 2 })

    statStageSystem({ world, delta: 1.5 })
    entity.set(StatStages, { attackTime: 15 }) // renovado
    statStageSystem({ world, delta: 1.5 })

    expect(entity.get(StatStages).attackStage).toBe(-1)
  })

  it('desmaiou: todos os estágios são resetados na hora', () => {
    const { world, entity } = spawn({
      attackStage: -2,
      attackTime: 10,
      defenseStage: 1,
      defenseTime: 10,
    })
    entity.add(Fainted)

    statStageSystem({ world, delta: 0.016 })

    expect(entity.get(StatStages)).toMatchObject({
      attackStage: 0,
      attackTime: 0,
      defenseStage: 0,
      defenseTime: 0,
    })
  })
})
