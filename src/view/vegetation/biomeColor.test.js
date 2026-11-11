import * as THREE from 'three'
import { afterEach, describe, expect, it } from 'vitest'
import { getBiome, listBiomes } from '@/core/data/biomes'
import { generateTerrainChunk } from '@/core/terrain/terrainChunk'
import {
  copyTerrainRecipe,
  createTerrainSampler,
  currentTerrainRecipe,
} from '@/core/terrain/terrainHeight'
import { createBiomeTint, withBiomeTint } from './biomeColor'

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

describe('withBiomeTint', () => {
  const green = new THREE.Color('#5cc417')
  const lumaOf = (color) =>
    color.r * 0.2126 + color.g * 0.7152 + color.b * 0.0722
  const hueOf = (color) => {
    const luma = lumaOf(color)
    return [color.r / luma, color.g / luma, color.b / luma]
  }

  it('sem tinta ou com força 0, a cor como está (e uma cópia)', () => {
    for (const tint of [null, undefined, { color: '#e0c060', amount: 0 }]) {
      const out = withBiomeTint(green, tint)
      expect(out).not.toBe(green)
      expect(out.equals(green)).toBe(true)
    }
  })

  it('na força cheia, fica com o tom da tinta e a luminância da cor', () => {
    const tint = { color: '#e0c060', amount: 1 }
    const out = withBiomeTint(green, tint)
    expect(lumaOf(out)).toBeCloseTo(lumaOf(green), 5)
    const target = hueOf(new THREE.Color(tint.color))
    hueOf(out).forEach((value, i) => expect(value).toBeCloseTo(target[i], 5))
  })

  it('a força mistura entre a cor e a tingida', () => {
    const full = withBiomeTint(green, { color: '#e0c060', amount: 1 })
    const half = withBiomeTint(green, { color: '#e0c060', amount: 0.5 })
    expect(half.r).toBeCloseTo((green.r + full.r) / 2, 5)
    expect(half.g).toBeCloseTo((green.g + full.g) / 2, 5)
    expect(half.b).toBeCloseTo((green.b + full.b) / 2, 5)
  })
})
