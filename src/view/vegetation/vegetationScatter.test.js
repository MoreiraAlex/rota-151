import { describe, expect, it } from 'vitest'
import { GAME_CONFIG } from '@/core/gameConfig'
import { generateTerrainChunk } from '@/core/terrain/terrainChunk'
import {
  copyTerrainRecipe,
  createTerrainSampler,
  currentTerrainRecipe,
} from '@/core/terrain/terrainHeight'
import { kindDensities, slopeAt } from '@/core/vegetation/vegetationDensity'
import {
  blendGrassColors,
  scatterArea,
  scatterTile,
  tileStart,
  tilesAround,
} from './vegetationScatter'

const { GRASS, TERRAIN } = GAME_CONFIG
const recipe = copyTerrainRecipe(currentTerrainRecipe())
const sampler = createTerrainSampler(13, recipe)
const chunk = generateTerrainChunk(sampler, 2, 1, recipe.terrain)
const tileSize = GRASS.TILE_SIZE
// Primeiro bloco dentro do chunk.
// O primeiro bloco inteiro dentro do chunk.
const tileX = Math.ceil(chunk.minX / tileSize + 0.5)
const tileZ = Math.ceil(chunk.minZ / tileSize + 0.5)

// Densidade igual em todo lugar.
const everywhere = (value) => ({ isEmpty: value === 0, at: () => value })

const scatter = (overrides = {}) =>
  scatterTile(chunk, {
    tileX,
    tileZ,
    tileSize,
    perM2: 2,
    density: everywhere(1),
    salt: 1,
    minHeight: -Infinity,
    maxSlope: Infinity,
    ...overrides,
  })

describe('tilesAround', () => {
  it('só blocos que tocam o raio, do mais perto ao mais longe', () => {
    const radius = 30
    const tiles = tilesAround(5, -7, radius, tileSize)
    expect(tiles.length).toBeGreaterThan(0)
    for (let i = 0; i < tiles.length; i++) {
      expect(tiles[i].distance).toBeLessThanOrEqual(radius)
      if (i > 0) {
        expect(tiles[i].distance).toBeGreaterThanOrEqual(tiles[i - 1].distance)
      }
    }
    expect(tiles[0].distance).toBe(0)
  })

  it('o chunk é um número ímpar de blocos (cada bloco num chunk só)', () => {
    const tilesPerChunk = TERRAIN.CHUNK_SIZE / tileSize
    expect(Number.isInteger(tilesPerChunk)).toBe(true)
    expect(tilesPerChunk % 2).toBe(1)
  })
})

describe('scatterTile', () => {
  it('mesmo bloco: os mesmos pontos', () => {
    expect(scatter()).toEqual(scatter())
  })

  it('tipos diferentes (salt): pontos diferentes', () => {
    expect(scatter({ salt: 10 }).positions).not.toEqual(scatter().positions)
  })

  it('todos os pontos dentro do bloco e no chão', () => {
    const { count, positions } = scatter()
    expect(count).toBeGreaterThan(0)
    for (let i = 0; i < count; i++) {
      const x = positions[i * 3]
      const z = positions[i * 3 + 2]
      expect(x).toBeGreaterThanOrEqual(tileStart(tileX, tileSize))
      expect(x).toBeLessThan(tileStart(tileX, tileSize) + tileSize)
      expect(z).toBeGreaterThanOrEqual(tileStart(tileZ, tileSize))
      expect(z).toBeLessThan(tileStart(tileZ, tileSize) + tileSize)
    }
  })

  it('densidade 1: quase uma por célula; 0: nenhuma', () => {
    const perM2 = 2
    const cells = tileSize * tileSize * perM2
    expect(scatter({ perM2 }).count).toBeGreaterThan(cells * 0.9)
    expect(scatter({ density: everywhere(0) }).count).toBe(0)
  })

  it('mais densidade, mais pontos', () => {
    expect(scatter({ density: everywhere(0.7) }).count).toBeGreaterThan(
      scatter({ density: everywhere(0.2) }).count,
    )
  })

  it('nada abaixo de minHeight nem em encosta acima de maxSlope', () => {
    const { positions: all } = scatter()
    const heights = all.filter((_, i) => i % 3 === 1)
    const minHeight = (Math.min(...heights) + Math.max(...heights)) / 2
    const maxSlope = 0.1
    const { count, positions } = scatter({ minHeight, maxSlope })
    for (let i = 0; i < count; i++) {
      expect(positions[i * 3 + 1]).toBeGreaterThanOrEqual(minHeight)
      expect(
        slopeAt(chunk, positions[i * 3], positions[i * 3 + 2]),
      ).toBeLessThanOrEqual(maxSlope)
    }
  })
})

describe('scatterArea — pegadas dos sólidos', () => {
  it('nada nasce dentro de uma pegada (avoid)', () => {
    const minX = tileStart(tileX, tileSize)
    const minZ = tileStart(tileZ, tileSize)
    const circle = { x: minX + 8, z: minZ + 8, radius: 3 }
    const options = {
      minX,
      minZ,
      size: tileSize,
      perM2: 4,
      density: everywhere(1),
      salt: 1,
      minHeight: -Infinity,
      maxSlope: Infinity,
    }
    const free = scatterArea(chunk, options)
    const avoided = scatterArea(chunk, { ...options, avoid: [circle] })
    expect(avoided.count).toBeLessThan(free.count)
    for (let i = 0; i < avoided.count; i++) {
      const x = avoided.positions[i * 3]
      const z = avoided.positions[i * 3 + 2]
      expect(Math.hypot(x - circle.x, z - circle.z)).toBeGreaterThanOrEqual(
        circle.radius,
      )
    }
  })
})

describe('blendGrassColors', () => {
  it('um bioma só com grama: as cores dele', () => {
    const colors = Array.from({ length: 12 }, (_, k) => k / 12)
    const colorsByBiome = chunk.biomeIds.map(() => colors)
    const out = new Float32Array(12)
    const densities = kindDensities(recipe.biomeList, chunk.biomeIds, 'x')
    densities.fill(1)
    blendGrassColors(
      chunk,
      densities,
      colorsByBiome,
      chunk.minX + 3,
      chunk.minZ + 4,
      out,
      0,
    )
    out.forEach((value, k) => expect(value).toBeCloseTo(colors[k], 5))
  })
})
