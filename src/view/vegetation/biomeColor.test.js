import * as THREE from 'three'
import { afterEach, describe, expect, it } from 'vitest'
import { getBiome, listBiomes } from '@/core/data/biomes'
import { GAME_CONFIG } from '@/core/gameConfig'
import { generateTerrainChunk } from '@/core/terrain/terrainChunk'
import {
  copyTerrainRecipe,
  createTerrainSampler,
  currentTerrainRecipe,
} from '@/core/terrain/terrainHeight'
import { KIND_COLOR, createBiomeColorFactor } from './biomeColor'

// Um bioma do registro com arbusto; o mundo só com ele.
const biome = listBiomes().find(({ vegetation }) =>
  vegetation.some(({ kind }) => kind === 'bush'),
)
const bushEntry = biome.vegetation.find(({ kind }) => kind === 'bush')
const recipe = copyTerrainRecipe({
  ...currentTerrainRecipe(),
  biomeList: [getBiome(biome.id)],
})
const chunk = generateTerrainChunk(
  createTerrainSampler(5, recipe),
  1,
  2,
  recipe.terrain,
)
const center = [chunk.minX + chunk.size / 2, chunk.minZ + chunk.size / 2]
const original = bushEntry.color

describe('createBiomeColorFactor', () => {
  afterEach(() => {
    bushEntry.color = original
  })

  it('sem `color` no bioma, nada a fazer', () => {
    delete bushEntry.color
    expect(createBiomeColorFactor(chunk, 'bush')).toBeNull()
  })

  it('tipo sem cor no config, nada a fazer', () => {
    expect(KIND_COLOR.fern).toBeUndefined()
    expect(createBiomeColorFactor(chunk, 'fern')).toBeNull()
  })

  it('a cor do tipo vezes o fator dá a `color` do bioma', () => {
    bushEntry.color = '#b08a3c'
    const factor = createBiomeColorFactor(chunk, 'bush')
    const result = factor(...center, new THREE.Color(1, 1, 1)).multiply(
      new THREE.Color(KIND_COLOR.bush(GAME_CONFIG)),
    )
    const expected = new THREE.Color(bushEntry.color)
    expect(result.r).toBeCloseTo(expected.r, 2)
    expect(result.g).toBeCloseTo(expected.g, 2)
    expect(result.b).toBeCloseTo(expected.b, 2)
  })
})
