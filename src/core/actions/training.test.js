import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { makeWorld } from '@/test/makeWorld'
import { getBiome, listBiomes } from '../data/biomes'
import { GAME_CONFIG } from '../gameConfig'
import { BUILDING_KIND, TRAINING_DUMMY_KIND } from '../town/townPlan'
import { Position, Training, TrainingObject } from '../traits'
import {
  carregarBonecosDoChunk,
  descarregarBonecosDoChunk,
  findNearbyTrainingObject,
} from './training'

// Os bonecos de treino (docs/features/067-campo-de-treino-e-avisos-de-
// nivel.md): um Pokémon por boneco e as entidades seguindo os chunks.
const CITY = listBiomes().find(({ town }) => town)
const DUMMY = getBiome(CITY.id).town.trainingField.dummy

let world

beforeEach(() => {
  ;({ world } = makeWorld())
})

afterEach(() => world?.destroy())

function spawnDummy(x, z) {
  return world.spawn(
    Position({ x, y: 0, z }),
    TrainingObject({ id: `${x},${z}`, chunkKey: 'test', radius: 0.4 }),
  )
}

function spawnTrainee(object) {
  return world.spawn(Position, Training({ moveId: 'ember', object }))
}

describe('boneco livre mais perto', () => {
  it('pega o mais perto dentro do alcance', () => {
    const near = spawnDummy(1, 0)
    spawnDummy(3, 0)
    expect(findNearbyTrainingObject(world, { x: 0, z: 0 })).toBe(near)
  })

  it('longe de todos, nenhum', () => {
    const { START_RADIUS } = GAME_CONFIG.MOVES.TRAINING
    spawnDummy(START_RADIUS + 5, 0)
    expect(findNearbyTrainingObject(world, { x: 0, z: 0 })).toBeNull()
  })

  it('o ocupado por outro Pokémon fica de fora', () => {
    const near = spawnDummy(1, 0)
    const far = spawnDummy(3, 0)
    spawnTrainee(near)
    expect(findNearbyTrainingObject(world, { x: 0, z: 0 })).toBe(far)
  })

  it('o boneco em que ela mesma treina conta como livre', () => {
    const near = spawnDummy(1, 0)
    const trainee = spawnTrainee(near)
    expect(
      findNearbyTrainingObject(world, { x: 0, z: 0 }, { creature: trainee }),
    ).toBe(near)
  })
})

describe('bonecos por chunk', () => {
  const chunk = {
    chunkX: 2,
    chunkZ: -1,
    solids: {
      buildings: [
        { kind: TRAINING_DUMMY_KIND, model: DUMMY, x: 1, y: 0, z: 1, scale: 1 },
        { kind: TRAINING_DUMMY_KIND, model: DUMMY, x: 4, y: 0, z: 1, scale: 1 },
        { kind: BUILDING_KIND, model: DUMMY, x: 9, y: 0, z: 9, scale: 1 },
      ],
    },
  }

  it('cada boneco do chunk vira uma entidade, uma vez só', () => {
    carregarBonecosDoChunk(world, chunk)
    carregarBonecosDoChunk(world, chunk)
    const objects = world.query(TrainingObject)
    expect(objects).toHaveLength(2)
    for (const entity of objects) {
      expect(entity.get(TrainingObject).radius).toBeGreaterThan(0)
    }
  })

  it('ao descarregar, os bonecos saem e quem treinava num deles para', () => {
    carregarBonecosDoChunk(world, chunk)
    const [object] = world.query(TrainingObject)
    const trainee = spawnTrainee(object)
    const key = object.get(TrainingObject).chunkKey

    descarregarBonecosDoChunk(world, key)

    expect(world.query(TrainingObject)).toHaveLength(0)
    expect(trainee.has(Training)).toBe(false)
  })
})
