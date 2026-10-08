import { afterEach, describe, expect, it } from 'vitest'
import { makeWorld } from '@/test/makeWorld'
import { GAME_CONFIG } from '../gameConfig'
import { TEST_LEVEL } from '../data/testLevel'
import { descarregarTodosOsChunks } from '../actions/chunks'
import { chunkCoordAt } from '../terrain/terrainChunk'
import { InputControlled, Position } from '../traits'
import { chunkStreamingSystem } from './chunkStreamingSystem'

const TERRAIN = GAME_CONFIG.TERRAIN
const worlds = []

afterEach(() => {
  descarregarTodosOsChunks()
  while (worlds.length) worlds.pop().destroy()
})

function setup(position = { x: 0, y: 2, z: 0 }) {
  const made = makeWorld({ playerPosition: position })
  worlds.push(made.world)
  return made
}

const tick = (world) => chunkStreamingSystem({ world, delta: 1 / 60 })
const loadedCount = () => TEST_LEVEL.terrain.loadedChunks().length
const side = (radius) => 2 * radius + 1

describe('chunkStreamingSystem', () => {
  it('no primeiro tick, o chão em volta do treinador carrega na hora', () => {
    const { world } = setup()
    tick(world)
    expect(loadedCount()).toBe(
      side(TERRAIN.NEAR_RADIUS) ** 2 + TERRAIN.CHUNKS_PER_TICK,
    )
    expect(TEST_LEVEL.terrain.isLoadedAt(0, 0)).toBe(true)
  })

  it('o resto entra aos poucos, até cobrir o raio de carregar', () => {
    const { world } = setup()
    const wanted = side(TERRAIN.LOAD_RADIUS) ** 2
    for (let i = 0; i < wanted; i++) tick(world)
    expect(loadedCount()).toBe(wanted)
    expect(TEST_LEVEL.terrain.streamingStatus().pending).toEqual([])
  })

  it('andando para longe, os chunks de trás descarregam', () => {
    const { world, player } = setup()
    for (let i = 0; i < side(TERRAIN.LOAD_RADIUS) ** 2; i++) tick(world)

    const far = TERRAIN.CHUNK_SIZE * (TERRAIN.UNLOAD_RADIUS + 3)
    player.set(Position, { x: far, y: 2, z: 0 })
    tick(world)

    expect(TEST_LEVEL.terrain.isLoaded(0, 0)).toBe(false)
    expect(TEST_LEVEL.terrain.isLoadedAt(far, 0)).toBe(true)
  })

  it('a criatura controlada também é centro', () => {
    const { world, player } = setup()
    const far = TERRAIN.CHUNK_SIZE * (TERRAIN.UNLOAD_RADIUS + 3)
    // Pilotada longe do treinador (como depois da troca de controle).
    player.remove(InputControlled)
    world.spawn(Position({ x: -far, y: 2, z: 0 }), InputControlled)

    tick(world)

    expect(TEST_LEVEL.terrain.isLoadedAt(0, 0)).toBe(true)
    expect(TEST_LEVEL.terrain.isLoadedAt(-far, 0)).toBe(true)
    expect(
      TEST_LEVEL.terrain.isLoaded(
        chunkCoordAt(-far / 2, TERRAIN.CHUNK_SIZE),
        0,
      ),
    ).toBe(false)
  })
})
