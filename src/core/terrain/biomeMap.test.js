import { describe, expect, it } from 'vitest'
import { GAME_CONFIG } from '../gameConfig'
import { listBiomes } from '../data/biomes'
import { deriveSeed } from '../rng'
import { CLIMATE_AXES, createBiomeSampler, noiseToFraction } from './biomeMap'

const PARAMS = GAME_CONFIG.BIOMES
const POINTS = Array.from({ length: 40 }, (_, i) => [
  i * 131.7 - 2600,
  i * -97.3 + 1900,
])
const sum = (values) => values.reduce((a, b) => a + b, 0)
const weightsOf = (sampler, x, z) => {
  const out = new Float64Array(sampler.biomes.length)
  sampler.weightsAt(x, z, out)
  return out
}

// Bioma de teste: sem faixa de clima (vive em qualquer lugar).
const sandboxBiome = (id, size) => ({ id, name: id, size, climate: {} })

// Comprimento médio (m) dos trechos seguidos de cada bioma numa linha reta.
function meanRuns(sampler, length, step) {
  const runs = new Map()
  let current = null
  let run = 0
  for (let x = 0; x <= length; x += step) {
    const { id } = sampler.biomeAt(x, 0)
    if (id !== current && current) {
      runs.set(current, [...(runs.get(current) ?? []), run])
      run = 0
    }
    current = id
    run += step
  }
  return new Map([...runs].map(([id, list]) => [id, sum(list) / list.length]))
}

describe('noiseToFraction', () => {
  it('leva o ruído para 0 a 1, crescendo, com o meio em 0', () => {
    expect(noiseToFraction(0)).toBeCloseTo(0.5, 6)
    expect(noiseToFraction(-5)).toBeGreaterThanOrEqual(0)
    expect(noiseToFraction(5)).toBeLessThanOrEqual(1)
    expect(noiseToFraction(0.2)).toBeGreaterThan(noiseToFraction(0.1))
  })
})

describe('createBiomeSampler', () => {
  it('mesma seed, mesmos pesos em todo ponto', () => {
    const a = createBiomeSampler(3)
    const b = createBiomeSampler(3)
    for (const [x, z] of POINTS) {
      expect(weightsOf(a, x, z)).toEqual(weightsOf(b, x, z))
    }
  })

  it('os pesos somam 1 e nunca são negativos', () => {
    const sampler = createBiomeSampler(3)
    for (const [x, z] of POINTS) {
      const weights = weightsOf(sampler, x, z)
      expect(sum(weights)).toBeCloseTo(1, 9)
      expect(Math.min(...weights)).toBeGreaterThanOrEqual(0)
    }
  })

  it('biomeAt é o bioma de maior peso', () => {
    const sampler = createBiomeSampler(3)
    for (const [x, z] of POINTS) {
      const weights = weightsOf(sampler, x, z)
      const best = weights.indexOf(Math.max(...weights))
      expect(sampler.biomeAt(x, z)).toBe(sampler.biomes[best])
    }
  })

  it('é contínuo: pontos muito próximos têm pesos próximos (sem degrau)', () => {
    const sampler = createBiomeSampler(3)
    for (const [x, z] of POINTS) {
      const here = weightsOf(sampler, x, z)
      const next = weightsOf(sampler, x + 0.01, z + 0.01)
      here.forEach((weight, i) =>
        expect(Math.abs(weight - next[i])).toBeLessThan(0.01),
      )
    }
  })

  it('a transição entre biomas nunca é mais curta que a grade de mistura', () => {
    // Dois biomas do mesmo clima disputando só pelas manchas: em qualquer
    // passo de um metro o peso muda no máximo o que a B-spline permite.
    const sampler = createBiomeSampler(3, {
      biomes: [sandboxBiome('a', 200), sandboxBiome('b', 900)],
    })
    let steepest = 0
    let previous = weightsOf(sampler, 0, 0)[0]
    for (let x = 1; x <= 3000; x += 1) {
      const weight = weightsOf(sampler, x, 0)[0]
      steepest = Math.max(steepest, Math.abs(weight - previous))
      previous = weight
    }
    // Derivada máxima da B-spline cúbica: 1 por célula.
    expect(steepest).toBeLessThanOrEqual(1 / PARAMS.BLEND_CELL + 1e-9)
  })

  it('o clima de cada eixo fica entre 0 e 1', () => {
    const sampler = createBiomeSampler(3)
    for (const [x, z] of POINTS) {
      const climate = sampler.climateAt(x, z)
      expect(climate).toHaveLength(CLIMATE_AXES.length)
      for (const value of climate) {
        expect(value).toBeGreaterThanOrEqual(0)
        expect(value).toBeLessThanOrEqual(1)
      }
    }
  })

  it('a origem é sempre terra firme, qualquer que seja a seed', () => {
    const continent = CLIMATE_AXES.indexOf('continent')
    // Biomas que aceitam a continentalidade garantida na origem.
    const landIds = listBiomes()
      .filter(({ climate }) => {
        const [min, max] = climate.continent ?? [0, 1]
        return min <= PARAMS.SPAWN_CONTINENT && PARAMS.SPAWN_CONTINENT <= max
      })
      .map(({ id }) => id)

    for (const seed of [1, 7, 151, 999, 123456]) {
      const sampler = createBiomeSampler(seed)
      expect(sampler.climateAt(0, 0)[continent]).toBeGreaterThanOrEqual(
        PARAMS.SPAWN_CONTINENT,
      )
      expect(landIds).toContain(sampler.biomeAt(0, 0).id)
    }
  })

  it('todos os biomas do registro aparecem no mundo do jogo', () => {
    // Grade grossa (um ponto da disputa por amostra): o que importa aqui é
    // quem vence, não a transição.
    const sampler = createBiomeSampler(
      deriveSeed(GAME_CONFIG.WORLD.SEED, 'terrain'),
      { params: { ...PARAMS, BLEND_CELL: 200 } },
    )
    const seen = new Set()
    for (let x = -15000; x <= 15000; x += 200) {
      for (let z = -15000; z <= 15000; z += 200) {
        seen.add(sampler.biomeAt(x, z).id)
      }
    }
    expect([...seen].sort()).toEqual(
      listBiomes()
        .map(({ id }) => id)
        .sort(),
    )
  })

  it('um bioma de size maior tem manchas maiores', () => {
    const runsWith = (size) =>
      meanRuns(
        createBiomeSampler(5, {
          params: { ...PARAMS, BLEND_CELL: 8 },
          biomes: [sandboxBiome('patch', size), sandboxBiome('ground', 4000)],
        }),
        40000,
        8,
      ).get('patch')

    expect(runsWith(600)).toBeGreaterThan(runsWith(200) * 1.5)
  })
})
