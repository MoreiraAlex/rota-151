import { afterEach, describe, expect, it } from 'vitest'
import { makeWorld } from '@/test/makeWorld'
import { GAME_CONFIG } from '../gameConfig'
import {
  TEST_LEVEL,
  getLevelRevision,
  rebuildTerrainDependentLevel,
} from '../data/testLevel'
import { Position } from '../traits'
import { getBiome } from '../data/biomes'
import { regenerarTerreno } from './terrain'
import { carregarChunk, descarregarTodosOsChunks } from './chunks'

const TERRAIN = GAME_CONFIG.TERRAIN
const original = { ...TERRAIN }
const worlds = []
let restoreBiome = null

afterEach(() => {
  Object.assign(TERRAIN, original)
  restoreBiome?.()
  restoreBiome = null
  descarregarTodosOsChunks()
  rebuildTerrainDependentLevel()
  while (worlds.length) worlds.pop().destroy()
})

function setup(position) {
  const { world, player } = makeWorld({ playerPosition: position })
  worlds.push(world)
  return { world, player }
}

describe('regenerarTerreno', () => {
  it('refaz o relevo com a config atual e avisa quem desenha', () => {
    const { world } = setup()
    const revision = getLevelRevision()
    const x = TERRAIN.CHUNK_SIZE * 0.37
    const before = TEST_LEVEL.terrain.heightAt(x, x)

    // O painel de ajuste sobe o chão do bioma que está ali.
    const biome = getBiome(TEST_LEVEL.terrain.biomeAt(x, x).id)
    const { baseHeight } = biome.relief
    restoreBiome = () => {
      biome.relief.baseHeight = baseHeight
    }
    biome.relief.baseHeight = baseHeight + 10
    regenerarTerreno(world)

    expect(getLevelRevision()).toBe(revision + 1)
    expect(TEST_LEVEL.terrain.heightAt(x, x)).toBeGreaterThan(before)
  })

  it('descarrega os chunks (o streaming carrega de novo com a receita nova)', () => {
    const { world } = setup()
    carregarChunk(0, 0)

    regenerarTerreno(world)

    expect(TEST_LEVEL.terrain.loadedChunks()).toEqual([])
  })

  it('quem ficou enterrado sobe para cima do chão', () => {
    const { world, player } = setup({ x: 10, y: -100, z: 10 })

    regenerarTerreno(world)

    expect(player.get(Position).y).toBeGreaterThan(
      TEST_LEVEL.terrain.heightAt(10, 10),
    )
  })

  it('quem está em cima do chão fica onde está', () => {
    const { world, player } = setup()
    const ground = TEST_LEVEL.terrain.heightAt(3, 3)
    const position = { x: 3, y: ground + 5, z: 3 }
    player.set(Position, position)

    regenerarTerreno(world)

    expect(player.get(Position)).toEqual(position)
  })
})
