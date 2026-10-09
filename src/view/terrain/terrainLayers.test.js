import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { listBiomes } from '@/core/data/biomes'
import { TERRAIN_LAYERS, terrainLayerPath } from './terrainLayers'

describe('camadas do chão', () => {
  it.each(TERRAIN_LAYERS)('%s tem o JPEG empacotado em public/', (layer) => {
    expect(existsSync(join('public', terrainLayerPath(layer)))).toBe(true)
  })

  it.each(listBiomes())('$id: as camadas do chão existem', ({ ground }) => {
    const { texture, slopeTexture, shoreTexture, peakTexture, trailTexture } =
      ground
    for (const layer of [
      texture,
      slopeTexture,
      shoreTexture,
      peakTexture,
      trailTexture,
    ]) {
      if (layer) expect(TERRAIN_LAYERS).toContain(layer)
    }
  })

  it('nomes sem repetição', () => {
    expect(new Set(TERRAIN_LAYERS).size).toBe(TERRAIN_LAYERS.length)
  })
})
