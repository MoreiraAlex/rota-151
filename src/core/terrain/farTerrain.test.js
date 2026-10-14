import { describe, expect, it } from 'vitest'
import { GAME_CONFIG } from '../gameConfig'
import {
  createFarTerrainGrid,
  farTerrainCenter,
  fillFarTerrainGrid,
} from './farTerrain'
import { generateTerrainChunk, heightIndex } from './terrainChunk'
import { createTerrainSampler } from './terrainHeight'

const { CHUNK_SIZE } = GAME_CONFIG.TERRAIN
const sampler = createTerrainSampler(5)
const biomeCount = sampler.biomes.length

const gridAt = (x, z, cell = CHUNK_SIZE * 2) => {
  const center = farTerrainCenter(x, z, CHUNK_SIZE)
  return createFarTerrainGrid({
    centerX: center.x,
    centerZ: center.z,
    radius: cell * 4,
    cell,
    biomeCount,
  })
}

describe('relevo distante (docs/features/051-montanha.md)', () => {
  it('o centro é um canto de chunk', () => {
    for (const [x, z] of [
      [0, 0],
      [37.2, -90.6],
      [-500.1, 3.3],
    ]) {
      const center = farTerrainCenter(x, z, CHUNK_SIZE)
      for (const value of [center.x, center.z]) {
        expect(Math.abs(value / CHUNK_SIZE - 0.5) % 1).toBeCloseTo(0, 6)
      }
      expect(Math.abs(center.x - x)).toBeLessThanOrEqual(CHUNK_SIZE / 2)
      expect(Math.abs(center.z - z)).toBeLessThanOrEqual(CHUNK_SIZE / 2)
    }
  })

  it('cobre o raio pedido em volta do centro', () => {
    const grid = gridAt(10, 10)
    const reach = ((grid.side - 1) / 2) * grid.cell
    expect(reach).toBeGreaterThanOrEqual(grid.cell * 4)
    expect(grid.minX + reach).toBe(grid.centerX)
    expect(grid.minZ + reach).toBe(grid.centerZ)
  })

  it('montar aos poucos dá a mesma grade que de uma vez', () => {
    const once = gridAt(40, -20)
    const slow = gridAt(40, -20)
    expect(fillFarTerrainGrid(once, sampler.sample, Infinity)).toBe(true)
    let done = false
    let rounds = 0
    while (!done) {
      done = fillFarTerrainGrid(slow, sampler.sample, 7)
      rounds++
    }
    expect(rounds).toBeGreaterThan(1)
    expect(slow.heights).toEqual(once.heights)
    expect(slow.biomeWeights).toEqual(once.biomeWeights)
  })

  it('os vértices têm a altura do chunk de verdade no mesmo canto', () => {
    const grid = gridAt(0, 0, CHUNK_SIZE)
    fillFarTerrainGrid(grid, sampler.sample, Infinity)
    const chunk = generateTerrainChunk(sampler, 1, -1)
    // Os quatro cantos do chunk são vértices da grade.
    for (const [cx, cz] of [
      [0, 0],
      [CHUNK_SIZE, 0],
      [0, CHUNK_SIZE],
      [CHUNK_SIZE, CHUNK_SIZE],
    ]) {
      const x = chunk.minX + cx
      const z = chunk.minZ + cz
      const ix = (x - grid.minX) / grid.cell
      const iz = (z - grid.minZ) / grid.cell
      expect(Number.isInteger(ix) && Number.isInteger(iz)).toBe(true)
      expect(grid.heights[iz * grid.side + ix]).toBe(
        chunk.heights[heightIndex(chunk.resolution, cx, cz)],
      )
    }
  })

  it('os pesos dos biomas de cada vértice somam 1', () => {
    const grid = gridAt(-200, 120)
    fillFarTerrainGrid(grid, sampler.sample, Infinity)
    for (let index = 0; index < grid.side * grid.side; index++) {
      let total = 0
      for (let biome = 0; biome < biomeCount; biome++) {
        total += grid.biomeWeights[index * biomeCount + biome]
      }
      expect(total / 255).toBeCloseTo(1, 1)
    }
  })
})
