import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { makeWorld } from '@/test/makeWorld'
import { TEST_LEVEL } from '../data/testLevel'
import { getBiome } from '../data/biomes'
import { getSpecies, listSpecies } from '../data/species'
import { createEventQueue, EVENT_TYPES } from '../events'
import { GAME_CONFIG } from '../gameConfig'
import { dayPhaseOf } from '../time/dayCycle'
import { weatherAt } from '../weather/worldWeather'
import {
  CameraTarget,
  CreatureLevel,
  OrbitCamera,
  Position,
  WildCreature,
  WildSpawnState,
  WorldClock,
} from '../traits'
import {
  isOutOfView,
  nearestDistance,
  spawnParams,
  spawnWeightOf,
} from '../wildSpawn/wildSpawn'
import { baseLevelAt, levelParams } from '../wildSpawn/wildLevel'
import { wildSpawnSystem } from './wildSpawnSystem'

// Spawn e despawn das selvagens em volta do jogador (docs/features/062-
// spawn-estilo-cobblemon.md). O relevo do nível vira um chão plano, seco e
// carregado, todo de um bioma que alguma espécie aceita — o teste olha as
// regras, não o mapa da seed.

const params = spawnParams()
const { INTERVAL } = GAME_CONFIG.WILD_SPAWN
const WILD_SPECIES = listSpecies().filter((species) => species.spawn)
const BIOME = getBiome(WILD_SPECIES[0].spawn.biomes[0])

beforeEach(() => {
  const { terrain } = TEST_LEVEL
  vi.spyOn(terrain, 'isLoadedAt').mockReturnValue(true)
  vi.spyOn(terrain, 'heightAt').mockReturnValue(params.WATER_LEVEL + 10)
  vi.spyOn(terrain, 'footprintsIn').mockReturnValue([])
  vi.spyOn(terrain, 'biomeAt').mockReturnValue(BIOME)
})

const worlds = []
afterEach(() => {
  vi.restoreAllMocks()
  while (worlds.length) worlds.pop().destroy()
})

function setup() {
  const made = makeWorld({ playerPosition: { x: 0, y: 0, z: 0 } })
  worlds.push(made.world)
  return { ...made, events: createEventQueue() }
}

// A faixa de raridade mais comum.
const COMMONEST = Object.keys(params.RARITY_CHANCES).reduce((best, rarity) =>
  params.RARITY_CHANCES[rarity] > params.RARITY_CHANCES[best] ? rarity : best,
)

// Uma hora em que alguma espécie da faixa mais comum nasce no bioma do
// teste (senão quase toda tentativa sai vazia).
function setSpawnableTime(world) {
  for (let hour = 0; hour < 24; hour++) {
    const time = hour / 24
    const phase = dayPhaseOf(time)
    const ok = WILD_SPECIES.some(
      (species) =>
        species.spawn.rarity === COMMONEST &&
        spawnWeightOf(species, {
          biome: BIOME,
          phase,
          weather: weatherAt(0, 0, time).type,
        }) > 0,
    )
    if (ok) {
      world.set(WorldClock, { time })
      return
    }
  }
  throw new Error('nenhuma hora com spawn comum no bioma do teste')
}

// Roda o spawn até o teto (cada passo é um intervalo).
function fill(world, events, steps = 200) {
  for (let i = 0; i < steps; i++) {
    wildSpawnSystem({ world, delta: INTERVAL, events })
  }
}

const wilds = (world) => world.query(WildCreature)

describe('wildSpawnSystem', () => {
  it('povoa até o teto por jogador, nunca além', () => {
    const { world, events } = setup()
    setSpawnableTime(world)

    fill(world, events)

    expect(wilds(world).length).toBe(params.MAX_PER_PLAYER)
  })

  it('nasce no máximo o limite por tentativa', () => {
    const { world, events } = setup()
    setSpawnableTime(world)

    for (let i = 0; i < 5; i++) {
      const before = wilds(world).length
      wildSpawnSystem({ world, delta: INTERVAL, events })
      expect(wilds(world).length - before).toBeLessThanOrEqual(
        GAME_CONFIG.WILD_SPAWN.SPAWNS_PER_INTERVAL,
      )
    }
  })

  it('espera o intervalo entre as tentativas', () => {
    const { world, events } = setup()
    setSpawnableTime(world)

    wildSpawnSystem({ world, delta: INTERVAL, events })
    const first = wilds(world).length
    wildSpawnSystem({ world, delta: INTERVAL / 4, events })

    expect(wilds(world).length).toBe(first)
  })

  it('nasce no anel, fora da vista, só espécie que pode nascer ali agora', () => {
    const { world, events } = setup()
    setSpawnableTime(world)
    const time = world.get(WorldClock).time
    const yaw = world.queryFirst(OrbitCamera).get(OrbitCamera).yaw
    const view = { ...world.queryFirst(CameraTarget).get(Position), yaw }

    fill(world, events)

    for (const entity of wilds(world)) {
      const position = entity.get(Position)
      const { speciesId } = entity.get(WildCreature)
      expect(nearestDistance(position, [view])).toBeGreaterThanOrEqual(
        params.MIN_RADIUS,
      )
      expect(isOutOfView(position, view)).toBe(true)
      const weight = spawnWeightOf(getSpecies(speciesId), {
        biome: BIOME,
        phase: dayPhaseOf(time),
        weather: weatherAt(position.x, position.z, time).type,
      })
      expect(weight).toBeGreaterThan(0)
    }
  })

  it('avisa cada nascimento e guarda no registro do debug', () => {
    const { world, events } = setup()
    setSpawnableTime(world)

    fill(world, events)

    const spawned = events
      .drain()
      .filter((event) => event.type === EVENT_TYPES.WILD_SPAWNED)
    expect(spawned.length).toBe(wilds(world).length)
    const { log } = world.get(WildSpawnState)
    expect(log.length).toBeLessThanOrEqual(
      GAME_CONFIG.WILD_SPAWN.DEBUG_LOG_SIZE,
    )
    expect(log.every((entry) => entry.kind === 'spawn')).toBe(true)
  })

  it('nasce no nível das cidades em volta, com a variação do indivíduo', () => {
    const { world, events } = setup()
    setSpawnableTime(world)

    fill(world, events)

    const { SPREAD } = levelParams()
    for (const entity of wilds(world)) {
      const { x, z } = entity.get(Position)
      const nearest = TEST_LEVEL.terrain.nearestCities(x, z, 2)
      const base = Math.round(baseLevelAt(GAME_CONFIG.WORLD.SEED, nearest))
      const { level } = entity.get(CreatureLevel)
      expect(Math.abs(level - base)).toBeLessThanOrEqual(SPREAD)
    }
  })

  it('na água, nada nasce', () => {
    const { world, events } = setup()
    setSpawnableTime(world)
    TEST_LEVEL.terrain.heightAt.mockReturnValue(params.WATER_LEVEL - 1)

    fill(world, events)

    expect(wilds(world).length).toBe(0)
  })
})
