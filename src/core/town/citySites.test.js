import { describe, expect, it } from 'vitest'
import { getBiome } from '../data/biomes'
import { GAME_CONFIG } from '../gameConfig'
import { createWaterBodies } from '../terrain/waterBodies'
import { createCitySites } from './citySites'

const PARAMS = GAME_CONFIG.CITIES
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
})
