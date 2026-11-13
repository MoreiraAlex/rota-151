import { describe, expect, it } from 'vitest'
import { listBiomes } from '../data/biomes'
import {
  PLANTINGS,
  plantingModelsOf,
  plantingsOf,
  withPlantings,
} from './plantings'
import { DECOR_KIND } from './townPlan'

// docs/features/069-revisao-do-bioma-cidade.md
const biome = listBiomes().find(
  ({ id, town }) => town && plantingModelsOf(id).length > 0,
)?.id
const placed = (model, yaw = 0) => ({
  kind: 'street-prop',
  model,
  x: 12.5,
  y: 3,
  z: -7.25,
  yaw,
  scale: 1.7,
  variant: 0,
  biome,
})

describe('plantingsOf', () => {
  it('o bioma da cidade tem flores para plantar', () => {
    expect(biome).toBeDefined()
  })

  it('cada plantado ganha flores do bioma, em cima da terra dele', () => {
    const models = plantingModelsOf(biome)
    for (const [model, planting] of Object.entries(PLANTINGS)) {
      const building = placed(model)
      const flowers = plantingsOf(building)
      expect(flowers.length).toBeGreaterThan(0)
      const [minX, minZ, maxX, maxZ] = planting.soil
      for (const flower of flowers) {
        expect(flower.kind).toBe(DECOR_KIND)
        expect(models).toContain(flower.model)
        expect(flower.y).toBeCloseTo(building.y + planting.top * building.scale)
        expect(flower.scale).toBeCloseTo(building.scale * planting.scale)
        const localX = (flower.x - building.x) / building.scale
        const localZ = (flower.z - building.z) / building.scale
        expect(localX).toBeGreaterThanOrEqual(minX)
        expect(localX).toBeLessThanOrEqual(maxX)
        expect(localZ).toBeGreaterThanOrEqual(minZ)
        expect(localZ).toBeLessThanOrEqual(maxZ)
      }
    }
  })

  it('as flores giram com o objeto e saem sempre iguais no mesmo lugar', () => {
    for (const model of Object.keys(PLANTINGS)) {
      const straight = plantingsOf(placed(model))
      const turned = plantingsOf(placed(model, Math.PI / 2))
      expect(plantingsOf(placed(model))).toEqual(straight)
      turned.forEach((flower, index) => {
        const from = straight[index]
        // Um quarto de volta: o +X do modelo vai para o -Z do mundo.
        expect(flower.x - 12.5).toBeCloseTo(from.z - -7.25)
        expect(flower.z - -7.25).toBeCloseTo(-(from.x - 12.5))
      })
    }
  })

  it('o que não é plantado, ou sem flor no bioma, não ganha nada', () => {
    expect(plantingsOf({ ...placed('viridian-bench') })).toEqual([])
    const [model] = Object.keys(PLANTINGS)
    expect(plantingsOf({ ...placed(model), biome: 'sem-bioma' })).toEqual([])
  })
})

describe('withPlantings', () => {
  it('mantém os objetos e põe as flores de cada plantado depois dele', () => {
    const [model] = Object.keys(PLANTINGS)
    const bench = placed('viridian-bench')
    const pot = placed(model)
    const all = withPlantings([bench, pot])
    expect(all[0]).toBe(bench)
    expect(all[1]).toBe(pot)
    expect(all.slice(2)).toEqual(plantingsOf(pot))
  })
})
