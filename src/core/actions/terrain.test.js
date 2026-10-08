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

const TERRAIN = GAME_CONFIG.TERRAIN
const original = { ...TERRAIN }
const worlds = []

afterEach(() => {
  Object.assign(TERRAIN, original)
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
    const before = TEST_LEVEL.terrain

    TERRAIN.HILL_HEIGHT = original.HILL_HEIGHT * 2
    regenerarTerreno(world)

    expect(getLevelRevision()).toBe(revision + 1)
    expect(TEST_LEVEL.terrain).not.toBe(before)
    expect(TEST_LEVEL.terrain.maxHeight).toBeGreaterThan(before.maxHeight)
  })

  it('quem ficou enterrado sobe para cima do chão', () => {
    const { world, player } = setup({ x: 10, y: -100, z: 10 })

    regenerarTerreno(world)

    expect(player.get(Position).y).toBeGreaterThan(
      TEST_LEVEL.terrain.heightAt(10, 10),
    )
  })

  it('quem ficou fora da área volta para dentro dela', () => {
    const { world, player } = setup({ x: 0, y: 0, z: 0 })
    TERRAIN.AREA_RADIUS = 0
    regenerarTerreno(world)
    player.set(Position, { x: 500, y: 50, z: -500 })

    regenerarTerreno(world)

    const { x, z } = player.get(Position)
    const { bounds } = TEST_LEVEL
    expect(x).toBeLessThan(bounds.maxX)
    expect(z).toBeGreaterThan(bounds.minZ)
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
