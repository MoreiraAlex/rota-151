import { describe, expect, it } from 'vitest'
import { getBiome } from '../data/biomes'
import { GAME_CONFIG } from '../gameConfig'
import { createWaterBodies } from '../terrain/waterBodies'
import { createCitySites } from './citySites'
import { createRoads } from './roads'

const PARAMS = GAME_CONFIG.ROADS
const SEED = 151

function roadsFor(seed) {
  const cities = createCitySites(seed, {
    town: getBiome('city').town,
    waterBodies: createWaterBodies(seed),
  })
  return { cities, roads: createRoads(seed, { cities }) }
}

const cellKey = ([x, z]) => `${x},${z}`

// As ligações entre as cidades de uma janela de células (as duas pontas).
function graphOf(roads, half) {
  const neighbors = new Map()
  const add = (a, b) => {
    if (!neighbors.has(cellKey(a))) neighbors.set(cellKey(a), [])
    neighbors.get(cellKey(a)).push(b)
  }
  for (let x = -half; x <= half; x++) {
    for (let z = -half; z <= half; z++) {
      for (const to of roads.linksOf(x, z)) {
        add([x, z], to)
        add(to, [x, z])
      }
    }
  }
  return neighbors
}

describe('createRoads', () => {
  const { cities, roads } = roadsFor(SEED)

  it('mesma seed, mesmas estradas', () => {
    const again = roadsFor(SEED).roads
    for (let x = -3; x <= 3; x++) {
      for (let z = -3; z <= 3; z++) {
        expect(again.linksOf(x, z)).toEqual(roads.linksOf(x, z))
      }
    }
  })

  it('cada cidade liga à vizinha de leste ou de norte, às vezes às duas', () => {
    let both = 0
    let total = 0
    for (let x = -6; x <= 6; x++) {
      for (let z = -6; z <= 6; z++) {
        const links = roads.linksOf(x, z)
        expect(links.length).toBeGreaterThanOrEqual(1)
        for (const [tx, tz] of links) {
          expect([
            [x + 1, z],
            [x, z + 1],
          ]).toContainEqual([tx, tz])
        }
        if (links.length === 2) both += 1
        total += 1
      }
    }
    expect(both).toBeGreaterThan(0)
    expect(both).toBeLessThan(total / 2)
  })

  it('de toda cidade se chega à primeira pelas estradas', () => {
    // A janela de dentro, buscando numa maior (o caminho pode sair dela).
    const inner = 4
    const graph = graphOf(roads, inner * 4)
    const reached = new Set([cellKey([0, 0])])
    const queue = [[0, 0]]
    while (queue.length > 0) {
      const cell = queue.pop()
      for (const next of graph.get(cellKey(cell)) ?? []) {
        if (reached.has(cellKey(next))) continue
        reached.add(cellKey(next))
        queue.push(next)
      }
    }
    for (let x = -inner; x <= inner; x++) {
      for (let z = -inner; z <= inner; z++) {
        expect(reached.has(cellKey([x, z]))).toBe(true)
      }
    }
  })

  it('a estrada sai de uma cidade e chega na outra', () => {
    for (let x = -2; x <= 2; x++) {
      for (let z = -2; z <= 2; z++) {
        const from = cities.cityAt(x, z)
        for (const to of roads.linksOf(x, z)) {
          const target = cities.cityAt(...to)
          expect(roads.distanceAt(from.x, from.z)).toBeCloseTo(0, 6)
          expect(roads.distanceAt(target.x, target.z)).toBeCloseTo(0, 6)
        }
      }
    }
  })

  it('a distância é a mesma da busca em todas as estradas em volta', () => {
    const all = roads.edgesIn([-6000, -6000, 6000, 6000])
    for (let i = 0; i < 200; i++) {
      const x = ((i * 377.3) % 8000) - 4000
      const z = ((i * 811.9) % 8000) - 4000
      let best = Infinity
      for (const { points } of all) {
        for (let p = 0; p + 3 < points.length; p += 2) {
          const [ax, az, bx, bz] = points.subarray(p, p + 4)
          const dx = bx - ax
          const dz = bz - az
          const t = Math.min(
            Math.max(((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz), 0),
            1,
          )
          best = Math.min(best, Math.hypot(x - ax - dx * t, z - az - dz * t))
        }
      }
      const reach = Math.max(PARAMS.WIDTH + PARAMS.EDGE, PARAMS.FORD_WIDTH) / 2
      const found = roads.distanceAt(x, z)
      if (best <= reach) expect(found).toBeCloseTo(best, 6)
      else expect(found > reach).toBe(true)
    }
  })

  it('a força é 1 no meio da estrada, longe das cidades, e some longe dela', () => {
    const from = cities.cityAt(0, 0)
    const [to] = roads.linksOf(0, 0)
    const target = cities.cityAt(...to)
    const [edge] = roads
      .edgesIn([
        Math.min(from.x, target.x),
        Math.min(from.z, target.z),
        Math.max(from.x, target.x),
        Math.max(from.z, target.z),
      ])
      .filter(({ id }) => id === `${from.id}>${target.id}`)
    // O ponto do meio do traçado: longe das duas cidades.
    const middle = Math.floor(edge.points.length / 4) * 2
    const [x, z] = [edge.points[middle], edge.points[middle + 1]]
    expect(roads.strengthAt(x, z)).toBeCloseTo(1, 6)
    expect(roads.fordAt(x, z)).toBeCloseTo(1, 6)
    expect(roads.strengthAt(x + PARAMS.FORD_WIDTH * 4, z)).toBe(0)
  })

  it('dentro da cidade a estrada some (valem as ruas)', () => {
    for (let x = -2; x <= 2; x++) {
      for (let z = -2; z <= 2; z++) {
        const city = cities.cityAt(x, z)
        expect(roads.strengthAt(city.x, city.z)).toBe(0)
      }
    }
  })
})
