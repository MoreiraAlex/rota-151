import { describe, expect, it } from 'vitest'
import { getBiome } from '../data/biomes'
import { GAME_CONFIG } from '../gameConfig'
import { createWaterBodies } from '../terrain/waterBodies'
import { createCitySites } from './citySites'
import { createFixedTown } from './fixedTown'

// As cidades procedurais ligadas (o jogo, nesta beta, só tem a primeira:
// `CITIES.ONLY_FIRST`, docs/features/069-revisao-do-bioma-cidade.md).
const PARAMS = { ...GAME_CONFIG.CITIES, ONLY_FIRST: false }
const { town } = getBiome('city')
const SEED = 151

const sitesFor = (seed, params = PARAMS) =>
  createCitySites(seed, {
    town,
    waterBodies: createWaterBodies(seed),
    params,
  })

const CELLS = Array.from({ length: 49 }, (_, i) => [
  (i % 7) - 3,
  Math.floor(i / 7) - 3,
])

describe('createCitySites', () => {
  it('mesma seed, mesmas cidades', () => {
    const a = sitesFor(SEED)
    const b = sitesFor(SEED)
    for (const [x, z] of CELLS) expect(a.cityAt(x, z)).toEqual(b.cityAt(x, z))
  })

  it('a primeira cidade fica na origem, com o porte da primeira', () => {
    for (const seed of [1, 7, SEED, 999]) {
      const first = sitesFor(seed).cityAt(0, 0)
      expect([first.x, first.z]).toEqual([0, 0])
      expect(first.size.id).toBe(PARAMS.FIRST_SIZE)
      expect(first.radius).toBe(first.size.radius)
    }
  })

  it('toda cidade fica perto do centro da própria célula', () => {
    const sites = sitesFor(SEED)
    const reach = PARAMS.JITTER * PARAMS.SPACING + 1e-9
    for (const [x, z] of CELLS) {
      const city = sites.cityAt(x, z)
      expect(Math.abs(city.x - x * PARAMS.SPACING)).toBeLessThanOrEqual(reach)
      expect(Math.abs(city.z - z * PARAMS.SPACING)).toBeLessThanOrEqual(reach)
      expect(sites.cellOf(city.x)).toBe(x)
      expect(sites.cellOf(city.z)).toBe(z)
    }
  })

  it('o porte sai de town.sizes e o raio é o dele', () => {
    const sites = sitesFor(SEED)
    for (const [x, z] of CELLS) {
      const city = sites.cityAt(x, z)
      expect(town.sizes).toContain(city.size)
      expect(city.radius).toBe(city.size.radius)
    }
  })

  it('sorteia todos os portes', () => {
    const sites = sitesFor(SEED)
    const seen = new Set(CELLS.map(([x, z]) => sites.cityAt(x, z).size.id))
    expect([...seen].sort()).toEqual(town.sizes.map(({ id }) => id).sort())
  })

  it('a maioria das cidades fica longe da água', () => {
    const water = createWaterBodies(SEED)
    const sites = sitesFor(SEED)
    const dry = CELLS.filter(([x, z]) => {
      const { x: cx, z: cz } = sites.cityAt(x, z)
      return (
        water.insideRiver(cx, cz) < -PARAMS.WATER_GAP &&
        water.insideLake(cx, cz) < -PARAMS.WATER_GAP
      )
    })
    expect(dry.length).toBeGreaterThan(CELLS.length * 0.9)
  })

  it('nearestCity é a mesma da busca em todas as cidades em volta', () => {
    const sites = sitesFor(SEED)
    for (let i = 0; i < 300; i++) {
      const x = ((i * 377.3) % 9000) - 4500
      const z = ((i * 811.9) % 9000) - 4500
      let best = Infinity
      const cellX = sites.cellOf(x)
      const cellZ = sites.cellOf(z)
      for (let dx = -3; dx <= 3; dx++) {
        for (let dz = -3; dz <= 3; dz++) {
          const city = sites.cityAt(cellX + dx, cellZ + dz)
          best = Math.min(best, Math.hypot(x - city.x, z - city.z))
        }
      }
      const { city, distance } = sites.nearestCity(x, z)
      expect(distance).toBeCloseTo(best, 9)
      expect(Math.hypot(x - city.x, z - city.z)).toBeCloseTo(distance, 9)
    }
  })

  it('nearestCities: as duas primeiras são as mesmas da busca em todas em volta, em ordem', () => {
    const sites = sitesFor(SEED)
    for (let i = 0; i < 300; i++) {
      const x = ((i * 377.3) % 9000) - 4500
      const z = ((i * 811.9) % 9000) - 4500
      const distances = []
      const cellX = sites.cellOf(x)
      const cellZ = sites.cellOf(z)
      for (let dx = -3; dx <= 3; dx++) {
        for (let dz = -3; dz <= 3; dz++) {
          const city = sites.cityAt(cellX + dx, cellZ + dz)
          distances.push(Math.hypot(x - city.x, z - city.z))
        }
      }
      distances.sort((a, b) => a - b)
      const [first, second] = sites.nearestCities(x, z, 2)
      expect(first.distance).toBeCloseTo(distances[0], 9)
      expect(second.distance).toBeCloseTo(distances[1], 9)
      expect(first.city).toBe(sites.nearestCity(x, z).city)
    }
  })
})

// A primeira cidade fixa (docs/features/069-revisao-do-bioma-cidade.md —
// Viridian): o disco dela cobre o mapa todo.
describe('createCitySites com a cidade fixa', () => {
  const fixedTown = createFixedTown({
    params: PARAMS.FIRST_TOWN,
    townBiome: getBiome('city'),
    waterLevel: GAME_CONFIG.TERRAIN.WATER_LEVEL,
  })

  it.runIf(fixedTown)(
    'a primeira é a fixa, na origem, com o raio do mapa',
    () => {
      const sites = createCitySites(SEED, {
        town,
        waterBodies: createWaterBodies(SEED),
        params: PARAMS,
        fixedTown,
      })
      const first = sites.cityAt(0, 0)
      expect([first.x, first.z]).toEqual([0, 0])
      expect(first.fixed).toBe(true)
      expect(first.radius).toBe(fixedTown.radius)
      expect(sites.cityAt(1, 0).fixed).toBeUndefined()
    },
  )

  it('só com a primeira (ONLY_FIRST): a mais próxima de qualquer ponto é ela', () => {
    const sites = sitesFor(SEED, { ...PARAMS, ONLY_FIRST: true })
    const first = sites.cityAt(0, 0)
    for (const [x, z] of [
      [0, 0],
      [PARAMS.SPACING * 2.3, -PARAMS.SPACING * 4.1],
      [-PARAMS.SPACING * 7, PARAMS.SPACING],
    ]) {
      const { city, distance } = sites.nearestCity(x, z)
      expect(city).toBe(first)
      expect(distance).toBeCloseTo(Math.hypot(x - first.x, z - first.z), 9)
      const nearest = sites.nearestCities(x, z, 2)
      expect(nearest).toHaveLength(1)
      expect(nearest[0].city).toBe(first)
    }
  })

  it('o jogo, nesta beta, só tem a primeira cidade', () => {
    expect(GAME_CONFIG.CITIES.ONLY_FIRST).toBe(true)
  })
})
