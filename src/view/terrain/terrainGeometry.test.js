import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { GAME_CONFIG } from '@/core/gameConfig'
import {
  copyTerrainRecipe,
  createTerrainSampler,
  currentTerrainRecipe,
} from '@/core/terrain/terrainHeight'
import {
  chunkHeightAt,
  generateTerrainChunk,
} from '@/core/terrain/terrainChunk'
import {
  addGroundLayers,
  buildTerrainChunkGeometry,
  terrainColorAt,
} from './terrainGeometry'
import { TERRAIN_COLOR_MODES } from './terrainColorMode'
import {
  MAX_TERRAIN_LAYERS,
  TERRAIN_LAYERS,
  terrainLayerIndex,
} from './terrainLayers'
import { listBiomes } from '@/core/data/biomes'

const { WATER_LEVEL } = GAME_CONFIG.TERRAIN
const { SHORE_HEIGHT, SLOPE_FULL } = GAME_CONFIG.TERRAIN_COLOR
const chunk = generateTerrainChunk(createTerrainSampler(9), 1, 0)

describe('buildTerrainChunkGeometry', () => {
  const geometry = buildTerrainChunkGeometry(chunk, WATER_LEVEL)
  const position = geometry.getAttribute('position')

  it('um vértice por ponto do chunk e dois triângulos por célula', () => {
    expect(position.count).toBe((chunk.resolution + 1) ** 2)
    expect(geometry.getIndex().count).toBe(chunk.resolution ** 2 * 6)
    expect(geometry.getAttribute('color').count).toBe(position.count)
  })

  it('cada vértice está em cima do relevo do chunk', () => {
    for (let i = 0; i < position.count; i += 37) {
      expect(position.getY(i)).toBeCloseTo(
        chunkHeightAt(chunk, position.getX(i), position.getZ(i)),
        4,
      )
    }
  })

  it('os triângulos são os do colisor: um ponto no meio de qualquer triângulo bate com chunkHeightAt', () => {
    const index = geometry.getIndex()
    const triangle = new THREE.Triangle()
    const center = new THREE.Vector3()
    for (let t = 0; t < index.count; t += 3 * 41) {
      triangle.setFromAttributeAndIndices(
        position,
        index.getX(t),
        index.getX(t + 1),
        index.getX(t + 2),
      )
      triangle.getMidpoint(center)
      expect(center.y).toBeCloseTo(chunkHeightAt(chunk, center.x, center.z), 4)
    }
  })

  it('as faces apontam para cima', () => {
    const normal = geometry.getAttribute('normal')
    for (let i = 0; i < normal.count; i += 29) {
      expect(normal.getY(i)).toBeGreaterThan(0)
    }
  })
})

const expectColor = (actual, hex) => {
  const expected = new THREE.Color(hex)
  expect(actual.r).toBeCloseTo(expected.r, 5)
  expect(actual.g).toBeCloseTo(expected.g, 5)
  expect(actual.b).toBeCloseTo(expected.b, 5)
}

describe('cor por bioma', () => {
  it('no modo bioma, cada vértice tem a cor de debug do bioma', () => {
    // Receita com um bioma só: todo vértice é 100% dele.
    const [biome] = listBiomes()
    const recipe = copyTerrainRecipe(currentTerrainRecipe())
    recipe.biomeList = [structuredClone(biome)]
    const single = generateTerrainChunk(createTerrainSampler(9, recipe), 0, 0)
    const colors = buildTerrainChunkGeometry(
      single,
      WATER_LEVEL,
      TERRAIN_COLOR_MODES.biome,
    ).getAttribute('color')

    for (let i = 0; i < colors.count; i += 53) {
      expectColor(
        new THREE.Color().fromBufferAttribute(colors, i),
        biome.palette.debug,
      )
    }
  })
})

describe('camadas de desenho do chão', () => {
  const layersOf = (biome, height, normalY) => {
    const weights = new Float32Array(MAX_TERRAIN_LAYERS)
    addGroundLayers(biome, height, normalY, 1, weights)
    return weights
  }
  const only = (layer) => {
    const weights = new Float32Array(MAX_TERRAIN_LAYERS)
    weights[terrainLayerIndex(layer)] = 1
    return weights
  }

  it('cabem nos pesos por vértice', () => {
    expect(TERRAIN_LAYERS.length).toBeLessThanOrEqual(MAX_TERRAIN_LAYERS)
  })

  it.each(listBiomes())('$id: usa só camadas que existem', ({ ground }) => {
    const names = [
      ground.texture,
      ground.slopeTexture,
      ground.shoreTexture,
      ground.peakTexture,
    ].filter(Boolean)
    for (const name of names) expect(TERRAIN_LAYERS).toContain(name)
    expect(ground.detail).toBeGreaterThanOrEqual(0)
    expect(ground.detail).toBeLessThanOrEqual(1)
  })

  it.each(listBiomes())('$id: chão, encosta, margem e pico', (biome) => {
    const { ground, palette } = biome
    const flatHeight = palette.highHeight / 2
    expect(layersOf(biome, flatHeight, 1)).toEqual(only(ground.texture))
    expect(layersOf(biome, flatHeight, SLOPE_FULL)).toEqual(
      only(ground.slopeTexture),
    )
    expect(layersOf(biome, -1, 1)).toEqual(
      only(ground.shoreTexture ?? ground.texture),
    )
    if (palette.peak) {
      expect(
        layersOf(biome, palette.peakHeight + SHORE_HEIGHT * 10, 1),
      ).toEqual(only(ground.peakTexture ?? ground.texture))
    }
  })

  it('na geometria, os pesos das camadas somam 1 e o desenho é o do bioma', () => {
    const geometry = buildTerrainChunkGeometry(chunk, WATER_LEVEL)
    const layers0 = geometry.getAttribute('groundLayers0')
    const layers1 = geometry.getAttribute('groundLayers1')
    const detail = geometry.getAttribute('groundDetail')
    const details = listBiomes().map(({ ground }) => ground.detail)
    for (let i = 0; i < layers0.count; i += 31) {
      let total = 0
      for (let c = 0; c < 4; c++) {
        total += layers0.array[i * 4 + c] + layers1.array[i * 4 + c]
      }
      expect(total).toBeCloseTo(1, 5)
      expect(detail.getX(i)).toBeGreaterThanOrEqual(Math.min(...details) - 1e-6)
      expect(detail.getX(i)).toBeLessThanOrEqual(Math.max(...details) + 1e-6)
    }
  })
})

describe.each(listBiomes())('terrainColorAt — $id', ({ palette }) => {
  const at = (height, normalY) =>
    terrainColorAt(palette, height, normalY, new THREE.Color())

  it('abaixo da água é o fundo; logo acima, a margem', () => {
    expectColor(at(-1, 1), palette.bed)
    expectColor(at(SHORE_HEIGHT / 2, 1), palette.shore)
  })

  it('encosta íngreme puxa para a cor de encosta', () => {
    const height = palette.highHeight / 2
    expect(at(height, 1).equals(at(height, SLOPE_FULL))).toBe(false)
    expectColor(at(height, SLOPE_FULL), palette.slope)
  })

  it.runIf(palette.peak)('no alto, a cor do pico', () => {
    expectColor(at(palette.peakHeight + SHORE_HEIGHT * 10, 1), palette.peak)
  })
})
