import { afterEach, describe, expect, it } from 'vitest'
import { makeWorld } from '@/test/makeWorld'
import { listSpecies } from '../data/species'
import { createEventQueue, EVENT_TYPES } from '../events'
import { GAME_CONFIG } from '../gameConfig'
import {
  CreatureLevel,
  IndividualValues,
  WildBehavior,
  WildCreature,
  WildSpawnInfo,
  WildSpawnState,
} from '../traits'
import { despawnarSelvagem, nascerSelvagem, removerSelvagem } from './wildSpawn'

// Nascer e sumir das selvagens (docs/features/062-spawn-estilo-
// cobblemon.md). Espécie só como dado de teste.

const [SPECIES] = listSpecies().filter((species) => species.spawn)
const AT = { x: 3, y: 1, z: 4 }

const worlds = []
afterEach(() => {
  while (worlds.length) worlds.pop().destroy()
})

function setup() {
  const { world } = makeWorld()
  worlds.push(world)
  return { world, events: createEventQueue() }
}

describe('nascerSelvagem', () => {
  it('nasce com idade zero, no nível da primeira cidade, e avisa', () => {
    const { world, events } = setup()

    const wild = nascerSelvagem(world, events, {
      speciesId: SPECIES.id,
      position: AT,
    })

    expect(wild.get(WildCreature).speciesId).toBe(SPECIES.id)
    expect(wild.get(WildSpawnInfo).age).toBe(0)
    expect(wild.get(CreatureLevel).level).toBe(
      GAME_CONFIG.WILD_SPAWN.LEVEL.FIRST_CITY,
    )
    const [event] = events.drain()
    expect(event.type).toBe(EVENT_TYPES.WILD_SPAWNED)
    expect(event.entity).toBe(wild)
  })

  it('com o indivíduo salvo, usa ele e não avisa sem eventos', () => {
    const { world } = setup()
    const individual = {
      individualValues: { hp: 1, attack: 2 },
      levelState: { level: GAME_CONFIG.EXPERIENCE.LEVEL_CAP, xp: 0 },
      temperament: 'hostile',
      age: GAME_CONFIG.WILD_SPAWN.MIN_AGE,
      rotationY: 1,
    }

    const wild = nascerSelvagem(world, null, {
      speciesId: SPECIES.id,
      position: AT,
      individual,
    })

    expect(wild.get(IndividualValues)).toMatchObject(
      individual.individualValues,
    )
    expect(wild.get(CreatureLevel).level).toBe(individual.levelState.level)
    expect(wild.get(WildBehavior).temperament).toBe('hostile')
    expect(wild.get(WildSpawnInfo).age).toBe(individual.age)
    expect(world.get(WildSpawnState).log).toEqual([])
  })

  it('espécie que não existe não nasce', () => {
    const { world, events } = setup()
    expect(
      nascerSelvagem(world, events, { speciesId: 'nada', position: AT }),
    ).toBe(null)
    expect(world.query(WildCreature).length).toBe(0)
  })
})

describe('despawnarSelvagem', () => {
  it('tira do mundo, avisa o motivo e guarda no registro', () => {
    const { world, events } = setup()
    const wild = nascerSelvagem(world, null, {
      speciesId: SPECIES.id,
      position: AT,
    })

    despawnarSelvagem(world, events, wild, 'far')

    expect(wild.isAlive()).toBe(false)
    const [event] = events.drain()
    expect(event).toMatchObject({
      type: EVENT_TYPES.WILD_DESPAWNED,
      speciesId: SPECIES.id,
      reason: 'far',
    })
    expect(world.get(WildSpawnState).log.at(-1)).toMatchObject({
      kind: 'despawn',
      reason: 'far',
    })
  })

  it('o registro guarda só os últimos', () => {
    const { world, events } = setup()
    const size = GAME_CONFIG.WILD_SPAWN.DEBUG_LOG_SIZE

    for (let i = 0; i < size * 2; i++) {
      nascerSelvagem(world, events, { speciesId: SPECIES.id, position: AT })
    }

    expect(world.get(WildSpawnState).log.length).toBe(size)
  })

  it('removerSelvagem tira sem avisar', () => {
    const { world, events } = setup()
    const wild = nascerSelvagem(world, null, {
      speciesId: SPECIES.id,
      position: AT,
    })

    removerSelvagem(wild)

    expect(wild.isAlive()).toBe(false)
    expect(events.drain()).toEqual([])
  })
})
