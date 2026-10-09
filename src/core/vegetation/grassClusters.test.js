import { describe, expect, it } from 'vitest'
import { getBiome } from '../data/biomes'
import { grassClusterAt } from './grassClusters'

// Os conjuntos de um bioma do registro (os números não importam: os testes
// mexem só no campo que testam).
const BASE = {
  density: 1,
  size: 14,
  sizeVariation: 0.5,
  roughness: 0.5,
  edge: 0.05,
  height: 1.2,
  holes: 0,
  coverage: 0.4,
  grouping: 0.3,
  variety: 0,
  background: 0,
  backgroundHeight: 0.5,
  clearingPreference: 0,
  ...getBiome('forest')?.vegetation.find((e) => e.clusters)?.clusters,
}
const POINTS = Array.from({ length: 900 }, (_, i) => [
  (i % 30) * 4.3 - 60,
  Math.floor(i / 30) * 3.9 - 55,
])
const mean = (values) => values.reduce((a, b) => a + b, 0) / values.length
const insideOf = (clusters, openness = null) =>
  POINTS.map(([x, z]) => grassClusterAt(3, clusters, x, z, openness).inside)

describe('grassClusterAt', () => {
  it('entre 0 e 1 e igual para a mesma seed e ponto', () => {
    for (const [x, z] of POINTS) {
      const a = grassClusterAt(3, BASE, x, z)
      expect(a.inside).toBeGreaterThanOrEqual(0)
      expect(a.inside).toBeLessThanOrEqual(1)
      expect(grassClusterAt(3, BASE, x, z)).toEqual(a)
    }
  })

  it('agrupa: parte do chão é conjunto e parte não', () => {
    const inside = insideOf({ ...BASE, holes: 0 })
    expect(inside.some((value) => value === 1)).toBe(true)
    expect(inside.some((value) => value === 0)).toBe(true)
  })

  it('mais quantidade, mais chão coberto', () => {
    const few = mean(insideOf({ ...BASE, coverage: 0.2 }))
    const many = mean(insideOf({ ...BASE, coverage: 0.7 }))
    expect(many).toBeGreaterThan(few)
  })

  it('dentro: a densidade e a altura do conjunto; fora: as de fundo', () => {
    const clusters = { ...BASE, variety: 0, holes: 0 }
    for (const [x, z] of POINTS) {
      const point = grassClusterAt(3, clusters, x, z)
      if (point.inside === 1) {
        expect(point.density).toBeCloseTo(clusters.density, 6)
        expect(point.height).toBeCloseTo(clusters.height, 6)
      }
      if (point.inside === 0) {
        expect(point.density).toBeCloseTo(clusters.background, 6)
        expect(point.height).toBeCloseTo(clusters.backgroundHeight, 6)
      }
    }
  })

  it('falhas abrem buracos dentro dos conjuntos', () => {
    const solid = mean(insideOf({ ...BASE, holes: 0 }))
    const holed = mean(insideOf({ ...BASE, holes: 1 }))
    expect(holed).toBeLessThan(solid)
  })

  it('preferência total por clareira: nada na mata fechada', () => {
    const clusters = { ...BASE, clearingPreference: 1 }
    expect(insideOf(clusters, 0).every((value) => value === 0)).toBe(true)
    expect(mean(insideOf(clusters, 1))).toBeGreaterThan(
      mean(insideOf({ ...BASE, clearingPreference: 0 }, 1)),
    )
  })
})
