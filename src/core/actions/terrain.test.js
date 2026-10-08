import { afterEach, describe, expect, it } from 'vitest'
import { makeWorld } from '@/test/makeWorld'
import { GAME_CONFIG } from '../gameConfig'
import {
  TEST_LEVEL,
  getLevelRevision,
  rebuildTerrainDependentLevel,
} from '../data/testLevel'
import { Position } from '../traits'
import { regenerarTerreno } from './terrain'
import { carregarChunk, descarregarTodosOsChunks } from './chunks'

const TERRAIN = GAME_CONFIG.TERRAIN
const original = { ...TERRAIN }
const worlds = []

afterEach(() => {
  Object.assign(TERRAIN, original)
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
    // Um ponto fora do vale da origem (altura 0 com qualquer seed).
    const x = TERRAIN.HILL_SIZE * 0.37
    const before = TEST_LEVEL.terrain.heightAt(x, x)

    TERRAIN.HILL_HEIGHT = original.HILL_HEIGHT * 2
    regenerarTerreno(world)

    expect(getLevelRevision()).toBe(revision + 1)
    expect(Math.abs(TEST_LEVEL.terrain.heightAt(x, x))).toBeGreaterThan(
      Math.abs(before),
    )
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
