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

// O ponto mais alto e o mais baixo que algum bioma alcança — o mais baixo
// abaixo do leito mais fundo dos lagos e rios (docs/features/057-lagos-e-
// rios.md): a fundura, o ruído do fundo e a curva do encontro com o relevo.
const reliefLimits = () => {
  const biomes = listBiomes()
  const { RIVER, LAKE, BED_ROUGHNESS, BLEND } = GAME_CONFIG.WATER_BODIES
  const deepestBed =
    Math.max(RIVER.DEPTH, LAKE.DEPTH) + BED_ROUGHNESS + BLEND / 4
  return {
    lowest: Math.min(
      ...biomes.map(({ relief }) => relief.baseHeight - relief.hillHeight),
      -deepestBed,
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
    // Sem lagos e rios: o fundo deles não segue o relevo de cima.
    const recipe = copyTerrainRecipe(currentTerrainRecipe())
    for (const biome of recipe.biomeList) delete biome.water
    const before = createTerrainSampler(10, recipe)
    const [x, z] = POINTS[7]
    const biome = before.biomeAt(x, z)

    const raised = copyTerrainRecipe(recipe)
    raised.biomeList.find(({ id }) => id === biome.id).relief.baseHeight += 10
    const after = createTerrainSampler(10, raised)

    expect(after.heightAt(x, z)).toBeGreaterThan(before.heightAt(x, z))
  })
})

describe('lagos e rios (docs/features/057-lagos-e-rios.md)', () => {
  // A receita sem `water` em nenhum bioma: o relevo sem lago nem rio.
  const dryRecipe = () => {
    const recipe = copyTerrainRecipe(currentTerrainRecipe())
    for (const biome of recipe.biomeList) delete biome.water
    return recipe
  }
  const GRID = []
  for (let x = -2000; x < 2000; x += 25) {
    for (let z = -2000; z < 2000; z += 25) GRID.push([x, z])
  }

  it('só cavam: nunca levantam o chão, e cavam em algum lugar', () => {
    const wet = createTerrainSampler(10)
    const dry = createTerrainSampler(10, dryRecipe())
    let carved = false
    for (const [x, z] of GRID) {
      const difference = wet.heightAt(x, z) - dry.heightAt(x, z)
      expect(difference).toBeLessThanOrEqual(1e-9)
      if (difference < -0.5) carved = true
    }
    expect(carved).toBe(true)
  })

  it('bioma sem `water` não ganha lago nem rio', () => {
    const recipe = currentTerrainRecipe()
    const withoutWater = recipe.biomeList.filter(({ water }) => !water)
    if (withoutWater.length === 0) return
    const wet = createTerrainSampler(10)
    const dry = createTerrainSampler(10, dryRecipe())
    for (const [x, z] of GRID) {
      const weights = new Float64Array(wet.biomes.length)
      wet.sample(x, z, weights)
      // Só no meio do bioma sem água (na fronteira vale a média).
      const own = wet.biomes.findIndex(({ water }) => !water)
      if (weights[own] < 1 - 1e-9) continue
      expect(wet.heightAt(x, z)).toBe(dry.heightAt(x, z))
    }
  })

  it('a cidade não tem lago nem rio', () => {
    expect(listBiomes().find(({ id }) => id === 'city').water).toBeUndefined()
  })

  it('a origem fica em terra', () => {
    const sampler = createTerrainSampler(GAME_CONFIG.WORLD.SEED)
    expect(sampler.heightAt(0, 0)).toBeGreaterThan(WATER_LEVEL)
  })
})

describe('cristas (`ridges`, docs/features/051-montanha.md)', () => {
  // `ridges` em todos os biomas (`undefined` = sem o campo).
  const withRidges = (ridges) => {
    const recipe = copyTerrainRecipe(currentTerrainRecipe())
    for (const biome of recipe.biomeList) biome.relief.ridges = ridges
    return createTerrainSampler(10, recipe)
  }

  it('`ridges` 0 é o relevo sem crista', () => {
    const plain = withRidges(undefined)
    const zero = withRidges(0)
    for (const [x, z] of POINTS) {
      expect(zero.heightAt(x, z)).toBe(plain.heightAt(x, z))
    }
  })

  it('com cristas o relevo muda, é o mesmo para a mesma seed e fica nos limites', () => {
    const { lowest, highest } = reliefLimits()
    const plain = withRidges(undefined)
    const a = withRidges(1)
    const b = withRidges(1)
    expect(
      POINTS.some(([x, z]) => a.heightAt(x, z) !== plain.heightAt(x, z)),
    ).toBe(true)
    for (const [x, z] of POINTS) {
      expect(a.heightAt(x, z)).toBe(b.heightAt(x, z))
      const height = a.heightAt(x, z) - WATER_LEVEL
      expect(height).toBeGreaterThanOrEqual(lowest)
      expect(height).toBeLessThanOrEqual(highest)
    }
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

describe('vau das estradas', () => {
  it('onde a estrada cruza rio ou lago, o leito fica raso', () => {
    const sampler = createTerrainSampler(GAME_CONFIG.WORLD.SEED)
    const { FORD_DEPTH } = GAME_CONFIG.ROADS
    const edges = sampler.roads.edgesIn([-5000, -5000, 5000, 5000])
    let crossings = 0
    for (const { points } of edges) {
      for (let i = 0; i < points.length; i += 2) {
        const [x, z] = [points[i], points[i + 1]]
        const height = sampler.heightAt(x, z)
        if (height < WATER_LEVEL) crossings += 1
        expect(height).toBeGreaterThanOrEqual(WATER_LEVEL - FORD_DEPTH - 1e-6)
      }
    }
    // A seed do jogo tem estrada cruzando água (o teste mede alguma coisa).
    expect(crossings).toBeGreaterThan(0)
  })
})
