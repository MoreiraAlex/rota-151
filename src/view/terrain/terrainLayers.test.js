import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { listBiomes } from '@/core/data/biomes'
import {
  MAX_COLOR_LAYERS,
  TERRAIN_COLOR_LAYERS,
  TERRAIN_LAYERS,
  terrainColorLayerPath,
  terrainLayerPath,
} from './terrainLayers'

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

  it.each(TERRAIN_COLOR_LAYERS.map(([layer]) => layer))(
    'camada de cor %s tem a textura empacotada em public/',
    (layer) => {
      expect(existsSync(join('public', terrainColorLayerPath(layer)))).toBe(
        true,
      )
    },
  )

  it('cabem nos pesos por vértice, sem repetir nome', () => {
    const names = TERRAIN_COLOR_LAYERS.map(([layer]) => layer)
    expect(names.length).toBeLessThanOrEqual(MAX_COLOR_LAYERS)
    expect(new Set(names).size).toBe(names.length)
  })

  it.each(listBiomes().filter(({ ground }) => ground.colors))(
    '$id: as camadas de cor existem e há base',
    ({ ground }) => {
      const names = TERRAIN_COLOR_LAYERS.map(([layer]) => layer)
      expect(ground.colors.base).toBeDefined()
      for (const layer of Object.values(ground.colors)) {
        expect(names).toContain(layer)
      }
    },
  )
})
