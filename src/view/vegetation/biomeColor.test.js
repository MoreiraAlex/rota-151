import * as THREE from 'three'
import { afterEach, describe, expect, it } from 'vitest'
import { getBiome, listBiomes } from '@/core/data/biomes'
import { generateTerrainChunk } from '@/core/terrain/terrainChunk'
import {
  copyTerrainRecipe,
  createTerrainSampler,
  currentTerrainRecipe,
} from '@/core/terrain/terrainHeight'
import { createBiomeTint } from './biomeColor'

// Um bioma do registro com arbusto do Let's Go; o mundo só com ele.
const biome = listBiomes().find(({ vegetation }) =>
  vegetation.some(({ kind, models }) => kind === 'bush' && models?.length),
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
const original = { tint: bushEntry.tint, models: bushEntry.models }

describe('createBiomeTint', () => {
  afterEach(() => {
    Object.assign(bushEntry, original)
    if (original.tint === undefined) delete bushEntry.tint
  })

  it('sem `tint` no bioma, nada a fazer', () => {
    delete bushEntry.tint
    expect(createBiomeTint(chunk, 'bush')).toBeNull()
  })

  it('tipo sem modelos não nasce: a tinta dele não conta', () => {
    bushEntry.tint = { color: '#b08a3c', amount: 0.5 }
    bushEntry.models = []
    expect(createBiomeTint(chunk, 'bush')).toBeNull()
  })

  it('força 0 é o mesmo que sem tinta', () => {
    bushEntry.tint = { color: '#b08a3c', amount: 0 }
    expect(createBiomeTint(chunk, 'bush')).toBeNull()
  })

  it('com um bioma só, dá a cor e a força da `tint` dele', () => {
    bushEntry.tint = { color: '#b08a3c', amount: 0.5 }
    const [r, g, b, amount] = createBiomeTint(chunk, 'bush')(...center)
    const expected = new THREE.Color(bushEntry.tint.color)
    expect(r).toBeCloseTo(expected.r, 2)
    expect(g).toBeCloseTo(expected.g, 2)
    expect(b).toBeCloseTo(expected.b, 2)
    expect(amount).toBeCloseTo(bushEntry.tint.amount, 2)
  })
})
