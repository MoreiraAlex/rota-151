import { describe, expect, it } from 'vitest'
import { GAME_CONFIG } from '@/core/gameConfig'
import {
  createFarTerrainGrid,
  fillFarTerrainGrid,
} from '@/core/terrain/farTerrain'
import { createTerrainSampler } from '@/core/terrain/terrainHeight'
import { solidParams } from '@/core/vegetation/solidPlacement'
import { buildFarTerrainGeometry } from './farTerrainGeometry'

const { WATER_LEVEL, CHUNK_SIZE } = GAME_CONFIG.TERRAIN
const sampler = createTerrainSampler(9)
const look = {
  waterLevel: WATER_LEVEL,
  sink: GAME_CONFIG.FAR_TERRAIN.SINK,
  canopyStrength: GAME_CONFIG.FAR_TERRAIN.CANOPY_STRENGTH,
  brightness: 1,
  altitudeFade: GAME_CONFIG.VEGETATION_ALTITUDE.FADE,
  solids: solidParams(),
  water: {
    shallow: GAME_CONFIG.WATER.SHALLOW_COLOR,
    deep: GAME_CONFIG.WATER.DEEP_COLOR,
    depth: GAME_CONFIG.WATER.DEEP_DEPTH,
  },
}

function filledGrid() {
  const grid = createFarTerrainGrid({
    centerX: CHUNK_SIZE / 2,
    centerZ: CHUNK_SIZE / 2,
    radius: CHUNK_SIZE * 12,
    cell: CHUNK_SIZE,
    biomeCount: sampler.biomes.length,
  })
  fillFarTerrainGrid(grid, sampler.sample, Infinity)
  return grid
}

describe('buildFarTerrainGeometry (docs/features/051-montanha.md)', () => {
  const grid = filledGrid()
  const geometry = buildFarTerrainGeometry(grid, sampler.biomes, look)
  const position = geometry.getAttribute('position')

  it('um vértice por ponto da grade e dois triângulos por célula', () => {
    expect(position.count).toBe(grid.side * grid.side)
    expect(geometry.getIndex().count).toBe((grid.side - 1) ** 2 * 6)
  })

  it('cada vértice fica `sink` abaixo do relevo (ou da água)', () => {
    for (let index = 0; index < position.count; index += 7) {
      const surface = Math.max(grid.heights[index], WATER_LEVEL)
      expect(position.getY(index)).toBeCloseTo(surface - look.sink, 4)
    }
  })

  it('as faces apontam para cima', () => {
    const index = geometry.getIndex()
    for (let face = 0; face < index.count; face += 3 * 11) {
      const [a, b, c] = [0, 1, 2].map((k) => index.getX(face + k))
      const ux = position.getX(b) - position.getX(a)
      const uz = position.getZ(b) - position.getZ(a)
      const vx = position.getX(c) - position.getX(a)
      const vz = position.getZ(c) - position.getZ(a)
      // y do produto vetorial (b − a) × (c − a).
      expect(uz * vx - ux * vz).toBeGreaterThan(0)
    }
  })

  it('sem a copa, a cor da mata é só a do chão', () => {
    const bare = buildFarTerrainGeometry(grid, sampler.biomes, {
      ...look,
      canopyStrength: 0,
    })
    const withCanopy = geometry.getAttribute('color').array
    const without = bare.getAttribute('color').array
    // Algum vértice em terra com árvore muda de cor; o resto, não.
    let changed = 0
    for (let i = 0; i < withCanopy.length; i++) {
      if (Math.abs(withCanopy[i] - without[i]) > 1e-4) changed++
    }
    expect(changed).toBeGreaterThan(0)
  })
})
