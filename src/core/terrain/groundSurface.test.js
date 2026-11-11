import { existsSync } from 'node:fs'
import { afterAll, describe, expect, it } from 'vitest'
import { TEST_LEVEL } from '../data/testLevel'
import { FOOTSTEP_GROUPS } from '../data/audio/footstepGroups'
import { GRASS_SOUNDS } from '../data/audio/grassSounds'
import { GAME_CONFIG } from '../gameConfig'
import { slopeAt } from '../vegetation/vegetationDensity'
import { findBiomePoints } from '@/tools/biomeLab/labPoints'
import { groundSurfaceAt } from './groundSurface'

// O chão para o som do passo (066).
const terrain = TEST_LEVEL.terrain
const { forest } = findBiomePoints(terrain, ['forest'])
const size = terrain.chunkSize()
const chunks = []
for (let dx = -2; dx <= 2; dx++) {
  for (let dz = -2; dz <= 2; dz++) {
    chunks.push(
      terrain.load(
        Math.floor(forest.x / size) + dx,
        Math.floor(forest.z / size) + dz,
      ),
    )
  }
}
afterAll(() => {
  for (const chunk of chunks) terrain.unload(chunk.chunkX, chunk.chunkZ)
})

// Os pontos planos dos chunks, de metro em metro, com o chão de cada um.
const points = chunks.flatMap((chunk) => {
  const found = []
  for (let x = chunk.minX + 0.5; x < chunk.minX + size; x += 1) {
    for (let z = chunk.minZ + 0.5; z < chunk.minZ + size; z += 1) {
      if (slopeAt(chunk, x, z) > GAME_CONFIG.GRASS.MAX_SLOPE) continue
      found.push({ chunk, x, z, surface: groundSurfaceAt(terrain, x, z) })
    }
  }
  return found
})

describe('groundSurfaceAt', () => {
  it('fora dos chunks carregados, chão', () => {
    expect(groundSurfaceAt({ loadedChunkAt: () => null }, 0, 0)).toBe('ground')
  })

  it('na floresta: grama dentro das manchas, chão entre elas', () => {
    const surfaces = new Set(points.map(({ surface }) => surface))
    expect(surfaces).toEqual(new Set(['grass', 'ground']))
  })

  it('na trilha, chão', () => {
    const { chunk, x, z } = points.find(({ surface }) => surface === 'grass')
    const trails = new Float32Array(chunk.heights.length).fill(1)
    const onTrail = { loadedChunkAt: () => ({ ...chunk, trails }) }
    expect(groundSurfaceAt(onTrail, x, z)).toBe('ground')
  })

  it('com a grama escondida, chão', () => {
    const { x, z } = points.find(({ surface }) => surface === 'grass')
    const hidden = { ...GAME_CONFIG.GRASS, VISIBLE: false }
    expect(
      groundSurfaceAt(terrain, x, z, GAME_CONFIG.GROUND_SURFACE, hidden),
    ).toBe('ground')
  })
})

describe('som do passo na grama', () => {
  it('todo arquivo citado existe', () => {
    for (const path of [...GRASS_SOUNDS.step.walk, ...GRASS_SOUNDS.step.run]) {
      expect(existsSync(`public${path}`)).toBe(true)
    }
  })

  it('só quem pisa troca o passo na grama', () => {
    expect(FOOTSTEP_GROUPS.medium.grass).toBe(true)
    expect(FOOTSTEP_GROUPS.crawl.grass).toBeFalsy()
    expect(FOOTSTEP_GROUPS.wing.grass).toBeFalsy()
  })
})
