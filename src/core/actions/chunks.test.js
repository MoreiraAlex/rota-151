import { afterEach, describe, expect, it } from 'vitest'
import { makeWorld } from '@/test/makeWorld'
import { GAME_CONFIG } from '../gameConfig'
import { TEST_LEVEL } from '../data/testLevel'
import { hasLevelNavigationRegion, isWalkableAt } from '../pathfinding'
import { createStaticLevel, hasLevelChunkCollider } from '../physics/colliders'
import {
  disposePhysics,
  initPhysics,
  markLevelBuilt,
  stepPhysics,
} from '../physics/physicsWorld'
import { castRay } from '../physics/raycast'
import { chunkKey } from '../terrain/terrainChunk'
import { ChunkFrozen, Velocity } from '../traits'
import {
  carregarChunk,
  congelarPorChunk,
  descarregarChunk,
  descarregarTodosOsChunks,
  descongelarPorChunk,
} from './chunks'

const worlds = []

afterEach(() => {
  descarregarTodosOsChunks()
  disposePhysics()
  while (worlds.length) worlds.pop().destroy()
})

// Física pronta e nível montado, como depois do `physicsBootstrapSystem`.
async function buildPhysics() {
  await initPhysics()
  createStaticLevel()
  markLevelBuilt()
}

const groundRay = (x, z) => {
  stepPhysics() // broad-phase só existe depois de um step (raycast.js)
  return castRay({ x, y: 100, z }, { x: 0, y: -1, z: 0 }, 200)
}

describe('carregarChunk / descarregarChunk', () => {
  it('carregar cria os dados, a grade e o colisor do chunk', async () => {
    await buildPhysics()

    carregarChunk(0, 0)

    expect(TEST_LEVEL.terrain.isLoaded(0, 0)).toBe(true)
    expect(hasLevelNavigationRegion(chunkKey(0, 0))).toBe(true)
    expect(hasLevelChunkCollider(0, 0)).toBe(true)
    expect(groundRay(0, 0).point.y).toBeCloseTo(
      TEST_LEVEL.terrain.heightAt(0, 0),
      3,
    )
  })

  it('descarregar libera os três: sem chão, sem grade', async () => {
    await buildPhysics()
    carregarChunk(0, 0)

    descarregarChunk(0, 0)

    expect(TEST_LEVEL.terrain.isLoaded(0, 0)).toBe(false)
    expect(hasLevelNavigationRegion(chunkKey(0, 0))).toBe(false)
    expect(hasLevelChunkCollider(0, 0)).toBe(false)
    expect(isWalkableAt(0, 0)).toBe(false)
    expect(groundRay(0, 0)).toBeNull()
  })

  it('sem física pronta, o colisor nasce depois, com o nível', async () => {
    carregarChunk(1, 0)
    expect(hasLevelChunkCollider(1, 0)).toBe(false)

    await buildPhysics()

    expect(hasLevelChunkCollider(1, 0)).toBe(true)
    const x = GAME_CONFIG.TERRAIN.CHUNK_SIZE
    expect(groundRay(x, 0)).not.toBeNull()
  })
})

describe('congelarPorChunk / descongelarPorChunk', () => {
  it('congelar põe a tag e zera a velocidade; descongelar tira a tag', () => {
    const { world, player } = makeWorld()
    worlds.push(world)
    player.set(Velocity, { x: 1, y: -2, z: 3 })

    congelarPorChunk(player)
    expect(player.has(ChunkFrozen)).toBe(true)
    expect(player.get(Velocity)).toEqual({ x: 0, y: 0, z: 0 })

    descongelarPorChunk(player)
    expect(player.has(ChunkFrozen)).toBe(false)
  })
})
