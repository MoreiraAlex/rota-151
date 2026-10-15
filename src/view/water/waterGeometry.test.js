import { describe, expect, it } from 'vitest'
import { generateTerrainChunk } from '@/core/terrain/terrainChunk'
import { createTerrainSampler } from '@/core/terrain/terrainHeight'
import { buildWaterChunkGeometry } from './waterGeometry'

const base = generateTerrainChunk(createTerrainSampler(4), 0, 0)
const WATER = 0

// Chunk com o chão numa rampa: metade abaixo da água, metade acima.
function rampChunk() {
  const chunk = { ...base, heights: Float32Array.from(base.heights) }
  const side = chunk.resolution + 1
  for (let ix = 0; ix < side; ix++) {
    for (let iz = 0; iz < side; iz++) {
      chunk.heights[iz + ix * side] = ix - chunk.resolution / 2
    }
  }
  chunk.minHeight = Math.min(...chunk.heights)
  return chunk
}

describe('buildWaterChunkGeometry', () => {
  it('chão todo acima da água: sem superfície', () => {
    const dry = { ...base, minHeight: WATER + 1 }
    expect(buildWaterChunkGeometry(dry, WATER)).toBeNull()
  })

  it('no nível da água, com a profundidade de cada vértice', () => {
    const chunk = rampChunk()
    const geometry = buildWaterChunkGeometry(chunk, WATER)
    const position = geometry.getAttribute('position')
    const depth = geometry.getAttribute('waterDepth')
    const side = chunk.resolution + 1
    for (let i = 0; i < position.count; i++) {
      expect(position.getY(i)).toBe(WATER)
      const ix = i % side
      const iz = Math.floor(i / side)
      expect(depth.getX(i)).toBeCloseTo(
        WATER - chunk.heights[iz + ix * side],
        5,
      )
    }
    geometry.dispose()
  })

  it('só as células com algum canto debaixo da água', () => {
    const chunk = rampChunk()
    const geometry = buildWaterChunkGeometry(chunk, WATER)
    const depth = geometry.getAttribute('waterDepth')
    const index = geometry.index.array
    for (let t = 0; t < index.length; t += 6) {
      const corners = Array.from(index.subarray(t, t + 6), (i) => depth.getX(i))
      expect(Math.max(...corners)).toBeGreaterThan(0)
    }
    const cells = chunk.resolution * chunk.resolution
    expect(index.length / 6).toBeLessThan(cells)
    geometry.dispose()
  })

  it('leva a correnteza de cada vértice (zero sem `flowAt`)', () => {
    const chunk = rampChunk()
    const still = buildWaterChunkGeometry(chunk, WATER)
    expect(
      [...still.getAttribute('waterFlow').array].every((v) => v === 0),
    ).toBe(true)

    const flowing = buildWaterChunkGeometry(chunk, WATER, (x) => ({
      x: x * 0.01,
      z: -1,
    }))
    const flow = flowing.getAttribute('waterFlow')
    const position = flowing.getAttribute('position')
    for (let i = 0; i < flow.count; i++) {
      expect(flow.getX(i)).toBeCloseTo(position.getX(i) * 0.01)
      expect(flow.getY(i)).toBe(-1)
    }
  })

  it('com `shoreReach`, cobre também a terra da beira até essa altura', () => {
    const chunk = rampChunk()
    const cellsOf = (geometry) => geometry.getIndex().count / 6
    const plain = buildWaterChunkGeometry(chunk, WATER)
    const withShore = buildWaterChunkGeometry(chunk, WATER, undefined, 2)
    expect(cellsOf(withShore)).toBeGreaterThan(cellsOf(plain))
    // Uma fileira de célula por metro de altura da rampa (1 m por célula).
    expect(cellsOf(withShore) - cellsOf(plain)).toBe(chunk.resolution * 2)

    const dry = { ...base, minHeight: WATER + 1 }
    expect(buildWaterChunkGeometry(dry, WATER, undefined, 2)).not.toBeNull()
  })
})
