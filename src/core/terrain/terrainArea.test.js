import { describe, expect, it } from 'vitest'
import { GAME_CONFIG } from '../gameConfig'
import { createHeightSampler } from './terrainHeight'
import { chunkHeightAt, heightIndex } from './terrainChunk'
import { createTerrainArea } from './terrainArea'
import { TEST_LEVEL } from '../data/testLevel'

const { CHUNK_SIZE, WATER_LEVEL } = GAME_CONFIG.TERRAIN
const { MAX_SLOPE_CLIMB } = GAME_CONFIG.PHYSICS.CHARACTER

describe('createTerrainArea', () => {
  const radius = 1
  const area = createTerrainArea({ seed: 3, radius })

  it('gera (2 × raio + 1)² chunks e os limites cobrem todos', () => {
    expect(area.chunks.length).toBe((2 * radius + 1) ** 2)
    const extent = (radius + 0.5) * CHUNK_SIZE
    expect(area.bounds).toEqual({
      minX: -extent,
      maxX: extent,
      minZ: -extent,
      maxZ: extent,
    })
  })

  it('heightAt usa o chunk certo dentro da área', () => {
    for (const chunk of area.chunks) {
      const x = chunk.minX + CHUNK_SIZE * 0.3
      const z = chunk.minZ + CHUNK_SIZE * 0.7
      expect(area.heightAt(x, z)).toBe(chunkHeightAt(chunk, x, z))
    }
  })

  it('fora da área, segue o ruído', () => {
    const x = area.bounds.maxX + CHUNK_SIZE
    expect(area.heightAt(x, 0)).toBe(createHeightSampler(3)(x, 0))
  })

  it('min/max da área são os dos chunks', () => {
    expect(area.minHeight).toBe(
      Math.min(...area.chunks.map((c) => c.minHeight)),
    )
    expect(area.maxHeight).toBe(
      Math.max(...area.chunks.map((c) => c.maxHeight)),
    )
  })
})

describe('relevo do nível (seed e parâmetros do jogo)', () => {
  const { terrain } = TEST_LEVEL

  it('tem vales abaixo do nível da água e chão acima dele', () => {
    expect(terrain.minHeight).toBeLessThan(WATER_LEVEL)
    expect(terrain.maxHeight).toBeGreaterThan(WATER_LEVEL)
  })

  it('nenhuma encosta passa do que o personagem consegue subir', () => {
    let steepest = 0
    for (const chunk of terrain.chunks) {
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
