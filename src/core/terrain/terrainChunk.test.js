import { describe, expect, it } from 'vitest'
import { GAME_CONFIG } from '../gameConfig'
import { createTerrainSampler } from './terrainHeight'
import {
  chunkCoordAt,
  chunkHeightAt,
  generateTerrainChunk,
  heightIndex,
} from './terrainChunk'

const { CHUNK_SIZE, GENERATION_VERSION } = GAME_CONFIG.TERRAIN
// Um vértice por metro.
const CHUNK_RESOLUTION = CHUNK_SIZE
const sampler = createTerrainSampler(7)

describe('generateTerrainChunk', () => {
  it('mesma entrada, mesmas alturas', () => {
    const a = generateTerrainChunk(createTerrainSampler(7), 2, -1)
    const b = generateTerrainChunk(createTerrainSampler(7), 2, -1)
    expect(a.heights).toEqual(b.heights)
  })

  it('tem (resolução + 1)² alturas, a versão de geração e min/max certos', () => {
    const chunk = generateTerrainChunk(sampler, 0, 0)
    expect(chunk.heights.length).toBe((CHUNK_RESOLUTION + 1) ** 2)
    expect(chunk.version).toBe(GENERATION_VERSION)
    expect(chunk.minHeight).toBe(Math.min(...chunk.heights))
    expect(chunk.maxHeight).toBe(Math.max(...chunk.heights))
  })

  it('o chunk (0, 0) fica centrado na origem', () => {
    const chunk = generateTerrainChunk(sampler, 0, 0)
    expect(chunk.minX).toBe(-CHUNK_SIZE / 2)
    expect(chunk.minZ).toBe(-CHUNK_SIZE / 2)
  })

  it('a borda comum de dois chunks vizinhos é igual (nos dois eixos)', () => {
    const last = CHUNK_RESOLUTION
    const center = generateTerrainChunk(sampler, 0, 0)
    const east = generateTerrainChunk(sampler, 1, 0)
    const south = generateTerrainChunk(sampler, 0, 1)
    for (let i = 0; i <= last; i++) {
      expect(east.heights[heightIndex(last, 0, i)]).toBe(
        center.heights[heightIndex(last, last, i)],
      )
      expect(south.heights[heightIndex(last, i, 0)]).toBe(
        center.heights[heightIndex(last, i, last)],
      )
    }
  })

  it('cada vértice tem a altura do ruído no seu ponto de mundo', () => {
    const chunk = generateTerrainChunk(sampler, -1, 2)
    const step = CHUNK_SIZE / CHUNK_RESOLUTION
    for (const [ix, iz] of [
      [0, 0],
      [3, 5],
      [CHUNK_RESOLUTION, 1],
    ]) {
      expect(chunk.heights[heightIndex(CHUNK_RESOLUTION, ix, iz)]).toBeCloseTo(
        sampler.heightAt(chunk.minX + ix * step, chunk.minZ + iz * step),
        4,
      )
    }
  })
})

describe('generateTerrainChunk — biomas', () => {
  const chunk = generateTerrainChunk(sampler, 1, -1)
  const biomeCount = chunk.biomeIds.length
  const weightsAt = (target, ix, iz) =>
    Array.from({ length: biomeCount }, (_, biome) => {
      const index = heightIndex(target.resolution, ix, iz)
      return target.biomeWeights[index * biomeCount + biome]
    })

  it('guarda os biomas do relevo, na ordem dos pesos', () => {
    expect(chunk.biomeIds).toEqual(sampler.biomes.map(({ id }) => id))
    expect(chunk.biomeIds).toContain(chunk.biome)
  })

  it('os pesos de cada vértice somam um inteiro (arredondados)', () => {
    for (let i = 0; i < chunk.heights.length; i += 97) {
      const ix = Math.floor(i / (CHUNK_RESOLUTION + 1))
      const iz = i % (CHUNK_RESOLUTION + 1)
      const total = weightsAt(chunk, ix, iz).reduce((a, b) => a + b, 0)
      expect(Math.abs(total - 255)).toBeLessThanOrEqual(biomeCount)
    }
  })

  it('a borda comum de dois chunks vizinhos tem os mesmos pesos', () => {
    const last = CHUNK_RESOLUTION
    const east = generateTerrainChunk(sampler, 2, -1)
    for (let i = 0; i <= last; i += 7) {
      expect(weightsAt(east, 0, i)).toEqual(weightsAt(chunk, last, i))
    }
  })
})

describe('chunkHeightAt', () => {
  const chunk = generateTerrainChunk(sampler, 0, 0)
  const step = CHUNK_SIZE / CHUNK_RESOLUTION

  it('nos vértices, devolve a altura do vértice', () => {
    for (const [ix, iz] of [
      [0, 0],
      [4, 9],
      [CHUNK_RESOLUTION, CHUNK_RESOLUTION],
    ]) {
      expect(
        chunkHeightAt(chunk, chunk.minX + ix * step, chunk.minZ + iz * step),
      ).toBeCloseTo(chunk.heights[heightIndex(CHUNK_RESOLUTION, ix, iz)], 5)
    }
  })

  it('no meio da diagonal (+x,-z → -x,+z) é a média dos dois cantos dela', () => {
    const ix = 3
    const iz = 6
    const x = chunk.minX + (ix + 0.5) * step
    const z = chunk.minZ + (iz + 0.5) * step
    const b = chunk.heights[heightIndex(CHUNK_RESOLUTION, ix + 1, iz)]
    const c = chunk.heights[heightIndex(CHUNK_RESOLUTION, ix, iz + 1)]
    expect(chunkHeightAt(chunk, x, z)).toBeCloseTo((b + c) / 2, 5)
  })

  it('fora do chunk, usa a borda mais próxima', () => {
    expect(chunkHeightAt(chunk, chunk.minX - 10, chunk.minZ)).toBeCloseTo(
      chunkHeightAt(chunk, chunk.minX, chunk.minZ),
      5,
    )
  })
})

describe('chunkCoordAt', () => {
  it('a origem e o que estiver a menos de meio chunk dela são o chunk 0', () => {
    expect(chunkCoordAt(0)).toBe(0)
    expect(chunkCoordAt(CHUNK_SIZE / 2 - 0.01)).toBe(0)
    expect(chunkCoordAt(-CHUNK_SIZE / 2)).toBe(0)
  })

  it('meio chunk adiante já é o vizinho', () => {
    expect(chunkCoordAt(CHUNK_SIZE / 2)).toBe(1)
    expect(chunkCoordAt(-CHUNK_SIZE / 2 - 0.01)).toBe(-1)
  })
})
