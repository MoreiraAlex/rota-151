import { afterEach, describe, expect, it } from 'vitest'
import { makeWorld } from '@/test/makeWorld'
import { spawnWild } from '@/test/spawnWild'
import { GAME_CONFIG } from '../gameConfig'
import { carregarChunk, descarregarTodosOsChunks } from '../actions/chunks'
import { ChunkFrozen, Velocity } from '../traits'
import { chunkFreezeSystem } from './chunkFreezeSystem'

const worlds = []

afterEach(() => {
  descarregarTodosOsChunks()
  while (worlds.length) worlds.pop().destroy()
})

const tick = (world) => chunkFreezeSystem({ world, delta: 1 / 60 })

describe('chunkFreezeSystem', () => {
  const far = GAME_CONFIG.TERRAIN.CHUNK_SIZE * 3

  function setup() {
    const { world, player } = makeWorld()
    worlds.push(world)
    const wild = spawnWild(world, { at: { x: far, y: 2, z: 0 } })
    carregarChunk(0, 0)
    return { world, player, wild }
  }

  it('congela quem está em chunk descarregado; quem está no carregado segue', () => {
    const { world, player, wild } = setup()
    wild.set(Velocity, { x: 1, y: 0, z: 0 })

    tick(world)

    expect(wild.has(ChunkFrozen)).toBe(true)
    expect(wild.get(Velocity)).toEqual({ x: 0, y: 0, z: 0 })
    expect(player.has(ChunkFrozen)).toBe(false)
  })

  it('o chunk voltou: descongela', () => {
    const { world, wild } = setup()
    tick(world)

    carregarChunk(3, 0)
    tick(world)

    expect(wild.has(ChunkFrozen)).toBe(false)
  })
})
