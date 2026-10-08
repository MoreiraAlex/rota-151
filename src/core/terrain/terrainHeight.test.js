import { describe, expect, it } from 'vitest'
import { GAME_CONFIG } from '../gameConfig'
import { listBiomes } from '../data/biomes'
import {
  copyTerrainRecipe,
  countLayers,
  createTerrainSampler,
  currentTerrainRecipe,
} from './terrainHeight'

const { WATER_LEVEL } = GAME_CONFIG.TERRAIN
const POINTS = Array.from({ length: 50 }, (_, i) => [
  i * 73.3 - 1800,
  i * -51.1 + 900,
])

// O ponto mais alto e o mais baixo que algum bioma alcança.
const reliefLimits = () => {
  const biomes = listBiomes()
  return {
    lowest: Math.min(
      ...biomes.map(({ relief }) => relief.baseHeight - relief.hillHeight),
    ),
    highest: Math.max(
      ...biomes.map(({ relief }) => relief.baseHeight + relief.hillHeight),
    ),
  }
}

describe('createTerrainSampler', () => {
  it('mesma seed dá a mesma altura em todo ponto', () => {
    const a = createTerrainSampler(10)
    const b = createTerrainSampler(10)
    for (const [x, z] of POINTS) expect(a.heightAt(x, z)).toBe(b.heightAt(x, z))
  })

  it('seeds diferentes dão relevos diferentes', () => {
    const a = createTerrainSampler(10)
    const b = createTerrainSampler(11)
    expect(POINTS.some(([x, z]) => a.heightAt(x, z) !== b.heightAt(x, z))).toBe(
      true,
    )
  })

  it('a altura fica entre o vale mais fundo e o morro mais alto dos biomas', () => {
    const { lowest, highest } = reliefLimits()
    const sampler = createTerrainSampler(10)
    for (const [x, z] of POINTS) {
      const height = sampler.heightAt(x, z) - WATER_LEVEL
      expect(height).toBeGreaterThanOrEqual(lowest)
      expect(height).toBeLessThanOrEqual(highest)
    }
  })

  it('é contínua: pontos muito próximos têm alturas próximas', () => {
    const sampler = createTerrainSampler(10)
    for (const [x, z] of POINTS) {
      expect(
        Math.abs(sampler.heightAt(x, z) - sampler.heightAt(x + 0.01, z)),
      ).toBeLessThan(0.05)
    }
  })

  it('sample devolve a altura e os pesos dos biomas (somam 1)', () => {
    const sampler = createTerrainSampler(10)
    const weights = new Float64Array(sampler.biomes.length)
    for (const [x, z] of POINTS) {
      expect(sampler.sample(x, z, weights)).toBe(sampler.heightAt(x, z))
      expect(weights.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 9)
    }
  })

  it('um bioma mais alto deixa o chão dele mais alto', () => {
    const recipe = copyTerrainRecipe(currentTerrainRecipe())
    const before = createTerrainSampler(10, recipe)
    const [x, z] = POINTS[7]
    const biome = before.biomeAt(x, z)

    const raised = copyTerrainRecipe(recipe)
    raised.biomeList.find(({ id }) => id === biome.id).relief.baseHeight += 10
    const after = createTerrainSampler(10, raised)

    expect(after.heightAt(x, z)).toBeGreaterThan(before.heightAt(x, z))
  })
})

describe('countLayers', () => {
  it('morros maiores ganham mais camadas de detalhe', () => {
    expect(countLayers(200)).toBeGreaterThan(countLayers(20))
  })

  it('sempre tem pelo menos uma camada', () => {
    expect(countLayers(2)).toBeGreaterThanOrEqual(1)
  })
})

describe('currentTerrainRecipe — biomas escondidos', () => {
  it('deixa de fora os biomas de BIOMES.HIDDEN', () => {
    const [kept, ...hidden] = listBiomes().map(({ id }) => id)
    const original = GAME_CONFIG.BIOMES.HIDDEN
    try {
      GAME_CONFIG.BIOMES.HIDDEN = hidden
      const recipe = currentTerrainRecipe()
      expect(recipe.biomeList.map(({ id }) => id)).toEqual([kept])

      // Com um bioma só, o mundo inteiro é ele.
      const sampler = createTerrainSampler(10, recipe)
      for (const [x, z] of POINTS) expect(sampler.biomeAt(x, z).id).toBe(kept)
    } finally {
      GAME_CONFIG.BIOMES.HIDDEN = original
    }
  })
})
