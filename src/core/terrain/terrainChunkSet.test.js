import { describe, expect, it, vi } from 'vitest'
import { GAME_CONFIG } from '../gameConfig'
import { deriveSeed } from '../rng'
import { getBiome } from '../data/biomes'
import { createTerrainSampler } from './terrainHeight'
import {
  chunkHeightAt,
  generateTerrainChunk,
  heightIndex,
  latticeHeightAt,
} from './terrainChunk'
import { createTerrainChunkSet } from './terrainChunkSet'

const { CHUNK_SIZE, WATER_LEVEL } = GAME_CONFIG.TERRAIN
const { MAX_SLOPE_CLIMB } = GAME_CONFIG.PHYSICS.CHARACTER

describe('latticeHeightAt', () => {
  it('dá a mesma altura que o chunk gerado ali', () => {
    const sampler = createTerrainSampler(5)
    const chunk = generateTerrainChunk(sampler, 1, -2)
    for (const [fx, fz] of [
      [0.1, 0.2],
      [0.37, 0.81],
      [0.5, 0.5],
      [0.93, 0.04],
    ]) {
      const x = chunk.minX + CHUNK_SIZE * fx
      const z = chunk.minZ + CHUNK_SIZE * fz
      expect(latticeHeightAt(sampler, x, z)).toBeCloseTo(
        chunkHeightAt(chunk, x, z),
        5,
      )
    }
  })
})

describe('createTerrainChunkSet', () => {
  it('carrega, diz o que está carregado e descarrega', () => {
    const set = createTerrainChunkSet({ seed: 3 })
    const chunk = set.load(1, 0)

    expect(set.isLoaded(1, 0)).toBe(true)
    expect(set.isLoadedAt(chunk.minX + 1, chunk.minZ + 1)).toBe(true)
    expect(set.isLoadedAt(0, 0)).toBe(false)
    expect(set.loadedChunks()).toEqual([chunk])

    expect(set.unload(1, 0)).toBe(chunk)
    expect(set.isLoaded(1, 0)).toBe(false)
    expect(set.unload(1, 0)).toBeNull()
  })

  it('carregar de novo dá o mesmo relevo', () => {
    const set = createTerrainChunkSet({ seed: 3 })
    const first = set.load(-2, 4)
    set.unload(-2, 4)
    expect(set.load(-2, 4).heights).toEqual(first.heights)
  })

  it('heightAt é o mesmo com o chunk carregado ou não', () => {
    const set = createTerrainChunkSet({ seed: 3 })
    const x = CHUNK_SIZE * 0.31
    const z = -CHUNK_SIZE * 0.17
    const unloaded = set.heightAt(x, z)
    set.load(0, 0)
    expect(set.heightAt(x, z)).toBeCloseTo(unloaded, 5)
  })

  it('biomeAt é o mesmo com o chunk carregado ou não', () => {
    const set = createTerrainChunkSet({ seed: 3 })
    const x = CHUNK_SIZE * 0.21
    const z = CHUNK_SIZE * 0.42
    const unloaded = set.biomeAt(x, z)
    set.load(0, 0)
    expect(set.biomeAt(x, z)).toBe(unloaded)
  })

  it('os chunks seguem a receita com que nasceram até o reconfigure', () => {
    const set = createTerrainChunkSet({ seed: 3 })
    const x = CHUNK_SIZE * 0.4
    const before = set.heightAt(x, x)
    // O painel de ajuste mexe no bioma do registro.
    const biome = getBiome(set.biomeAt(x, x).id)
    const original = biome.relief.baseHeight
    try {
      biome.relief.baseHeight += 10
      expect(set.heightAt(x, x)).toBe(before)
    } finally {
      biome.relief.baseHeight = original
    }
  })

  it('avisa quem assina quando carrega, descarrega ou muda o status', () => {
    const set = createTerrainChunkSet({ seed: 3 })
    const listener = vi.fn()
    set.subscribe(listener)

    set.load(0, 0)
    set.unload(0, 0)
    set.setStreamingStatus({ pending: ['1,1'], kept: [] })
    set.setStreamingStatus({ pending: ['1,1'], kept: [] })

    expect(listener).toHaveBeenCalledTimes(3)
  })

  it('reconfigure troca a receita, mas só sem chunk carregado', () => {
    const set = createTerrainChunkSet({ seed: 3 })
    set.load(0, 0)
    expect(() => set.reconfigure(4)).toThrow()

    set.unload(0, 0)
    const x = CHUNK_SIZE * 0.4
    const before = set.heightAt(x, x)
    set.reconfigure(4)
    expect(set.heightAt(x, x)).not.toBe(before)
  })
})

describe('relevo do jogo (seed e parâmetros do jogo, em volta da origem)', () => {
  const sampler = createTerrainSampler(
    deriveSeed(GAME_CONFIG.WORLD.SEED, 'terrain'),
  )
  const chunks = []
  for (let chunkX = -1; chunkX <= 1; chunkX++) {
    for (let chunkZ = -1; chunkZ <= 1; chunkZ++) {
      chunks.push(generateTerrainChunk(sampler, chunkX, chunkZ))
    }
  }

  it('a origem fica acima da água (o treinador nasce em terra firme)', () => {
    expect(latticeHeightAt(sampler, 0, 0)).toBeGreaterThan(WATER_LEVEL)
  })

  it('tem vales abaixo do nível da água e chão acima dele', () => {
    expect(Math.min(...chunks.map((c) => c.minHeight))).toBeLessThan(
      WATER_LEVEL,
    )
    expect(Math.max(...chunks.map((c) => c.maxHeight))).toBeGreaterThan(
      WATER_LEVEL,
    )
  })

  it('nenhuma encosta passa do que o personagem consegue subir', () => {
    let steepest = 0
    for (const chunk of chunks) {
      const { resolution, heights } = chunk
      const step = chunk.size / resolution
      for (let ix = 0; ix < resolution; ix++) {
        for (let iz = 0; iz < resolution; iz++) {
          const here = heights[heightIndex(resolution, ix, iz)]
          const east = heights[heightIndex(resolution, ix + 1, iz)]
          const south = heights[heightIndex(resolution, ix, iz + 1)]
          steepest = Math.max(
            steepest,
            Math.abs(east - here) / step,
            Math.abs(south - here) / step,
          )
        }
      }
    }
    expect(steepest).toBeLessThan(Math.tan(MAX_SLOPE_CLIMB))
  })
})
