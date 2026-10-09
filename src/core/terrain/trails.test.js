import { describe, expect, it } from 'vitest'
import { listBiomes } from '../data/biomes'
import { GAME_CONFIG } from '../gameConfig'
import { createKindDensity } from '../vegetation/vegetationDensity'
import { generateTerrainChunk, heightIndex } from './terrainChunk'
import {
  copyTerrainRecipe,
  createTerrainSampler,
  currentTerrainRecipe,
} from './terrainHeight'
import { carveTrails, chunkTrails, trailAt } from './trails'

const withTrails = listBiomes().find(({ trails }) => trails)
const without = listBiomes().find(({ trails }) => !trails)

// Mundo só com o bioma `biome` (do registro inteiro).
function worldOf(biome) {
  return copyTerrainRecipe({ ...currentTerrainRecipe(), biomeList: [biome] })
}

function chunkOf(recipe, seed, chunkX, chunkZ) {
  const sampler = createTerrainSampler(seed, recipe)
  const chunk = generateTerrainChunk(sampler, chunkX, chunkZ, recipe.terrain)
  chunk.trails = chunkTrails(chunk, { seed, biomeList: recipe.biomeList })
  return chunk
}

// Chunks com o meio de uma trilha (força cheia em algum vértice) — procura
// numa área da seed.
function chunksWithTrails(recipe, seed) {
  const chunks = []
  for (let chunkX = -20; chunkX <= 20 && chunks.length < 3; chunkX++) {
    for (let chunkZ = -4; chunkZ <= 4 && chunks.length < 3; chunkZ++) {
      const chunk = chunkOf(recipe, seed, chunkX, chunkZ)
      if (chunk.trails?.some((value) => value === 1)) chunks.push(chunk)
    }
  }
  return chunks
}

describe.runIf(withTrails)('chunkTrails', () => {
  const recipe = worldOf(withTrails)
  const chunks = chunksWithTrails(recipe, 7)

  it('o bioma tem trilhas: aparece trilha em alguns chunks', () => {
    expect(chunks.length).toBeGreaterThan(0)
  })

  it('força entre 0 e 1, igual para a mesma seed e chunk', () => {
    for (const chunk of chunks) {
      for (const value of chunk.trails) {
        expect(value).toBeGreaterThanOrEqual(0)
        expect(value).toBeLessThanOrEqual(1)
      }
      const again = chunkOf(recipe, 7, chunk.chunkX, chunk.chunkZ)
      expect(again.trails).toEqual(chunk.trails)
    }
  })

  it('sem trilha debaixo da água', () => {
    const { WATER_LEVEL } = GAME_CONFIG.TERRAIN
    const { SHORE_GAP } = GAME_CONFIG.TRAILS
    for (const chunk of chunks) {
      chunk.trails.forEach((value, index) => {
        if (chunk.heights[index] < WATER_LEVEL + SHORE_GAP) {
          expect(value).toBe(0)
        }
      })
    }
  })

  it('a trilha continua na borda entre chunks vizinhos', () => {
    const left = chunkOf(recipe, 7, 0, 0)
    const right = chunkOf(recipe, 7, 1, 0)
    const { resolution } = left
    for (let iz = 0; iz <= resolution; iz++) {
      const a = left.trails?.[heightIndex(resolution, resolution, iz)] ?? 0
      const b = right.trails?.[heightIndex(resolution, 0, iz)] ?? 0
      expect(a).toBeCloseTo(b, 4)
    }
  })

  it('a vegetação não nasce no meio da trilha', () => {
    const chunk = chunks[0]
    const kind = withTrails.vegetation[0].kind
    const density = createKindDensity(chunk, kind, {
      biomeList: recipe.biomeList,
      seed: 7,
    })
    const step = chunk.size / chunk.resolution
    let checked = 0
    for (let ix = 0; ix <= chunk.resolution; ix++) {
      for (let iz = 0; iz <= chunk.resolution; iz++) {
        const x = chunk.minX + ix * step
        const z = chunk.minZ + iz * step
        if (trailAt(chunk, x, z) < 1 - 1e-6) continue
        expect(density.at(x, z)).toBeCloseTo(0, 6)
        checked += 1
      }
    }
    expect(checked).toBeGreaterThan(0)
  })

  it("o de `place: 'trail'` só nasce na trilha", () => {
    const chunk = chunks[0]
    const biome = {
      ...withTrails,
      vegetation: [{ kind: 'seixo', density: 0.8, place: 'trail' }],
    }
    const density = createKindDensity(chunk, 'seixo', {
      biomeList: [biome],
      seed: 7,
    })
    const step = chunk.size / chunk.resolution
    for (let ix = 0; ix <= chunk.resolution; ix += 3) {
      for (let iz = 0; iz <= chunk.resolution; iz += 3) {
        const x = chunk.minX + ix * step
        const z = chunk.minZ + iz * step
        if (trailAt(chunk, x, z) === 0) {
          expect(density.at(x, z)).toBe(0)
        }
      }
    }
  })
})

describe.runIf(withTrails)('carveTrails', () => {
  const recipe = worldOf(withTrails)
  const { DEPTH, BANK } = GAME_CONFIG.TRAILS

  it('afunda o meio, ergue a beirada e não mexe fora da trilha', () => {
    const [chunk] = chunksWithTrails(recipe, 7)
    const before = Float32Array.from(chunk.heights)
    carveTrails(chunk, chunk.trails)
    chunk.trails.forEach((strength, index) => {
      const change = chunk.heights[index] - before[index]
      if (strength === 0) expect(change).toBe(0)
      if (strength === 1) expect(change).toBeCloseTo(-DEPTH, 5)
      expect(change).toBeLessThanOrEqual(BANK + 1e-6)
    })
    expect(chunk.minHeight).toBe(Math.min(...chunk.heights))
    expect(chunk.maxHeight).toBe(Math.max(...chunk.heights))
  })

  it('chunks vizinhos afundam igual na borda', () => {
    const left = chunkOf(recipe, 7, 0, 0)
    const right = chunkOf(recipe, 7, 1, 0)
    carveTrails(left, left.trails)
    carveTrails(right, right.trails)
    const { resolution } = left
    for (let iz = 0; iz <= resolution; iz++) {
      expect(left.heights[heightIndex(resolution, resolution, iz)]).toBeCloseTo(
        right.heights[heightIndex(resolution, 0, iz)],
        4,
      )
    }
  })
})

describe.runIf(without)('chunkTrails — bioma sem trilhas', () => {
  it('nenhuma trilha', () => {
    const recipe = worldOf(without)
    for (const [chunkX, chunkZ] of [
      [0, 0],
      [2, -1],
    ]) {
      expect(chunkOf(recipe, 7, chunkX, chunkZ).trails).toBeNull()
    }
  })
})
