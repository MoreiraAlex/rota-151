import { describe, expect, it } from 'vitest'
import { listTownMaps, townMapCollidersOf } from '@/core/data/townMaps'
import { buildTownMapWaterGeometry } from './townMapWater'

// O mar do mapa de uma cidade copiada (docs/features/069-revisao-do-bioma-
// cidade.md).
const SHORE = 1
const REACH = 50
const DEEP = 3

describe('buildTownMapWaterGeometry', () => {
  it('sem água, nada', () => {
    const colliders = {
      ground: {
        nx: 2,
        nz: 2,
        minX: 0,
        minZ: 0,
        step: 1,
        heights: [0, 0, 0, 0],
      },
      water: null,
    }
    expect(
      buildTownMapWaterGeometry(colliders, 1, SHORE, REACH, DEEP),
    ).toBeNull()
  })

  for (const townMap of listTownMaps()) {
    const colliders = townMapCollidersOf(townMap)
    if (!colliders.water) continue

    it(`${townMap.id}: plana na superfície, com mar fundo além da borda sul`, () => {
      const scale = 1.5
      const geometry = buildTownMapWaterGeometry(
        colliders,
        scale,
        SHORE,
        REACH,
        DEEP,
      )
      const position = geometry.getAttribute('position')
      const depth = geometry.getAttribute('waterDepth')
      const southEdge =
        colliders.ground.minZ +
        (colliders.ground.nz - 1) * colliders.ground.step
      let beyond = 0
      for (let i = 0; i < position.count; i++) {
        expect(position.getY(i)).toBeCloseTo(colliders.water.surface, 5)
        if (position.getZ(i) > southEdge) {
          beyond++
          expect(depth.getX(i)).toBe(DEEP)
        }
      }
      expect(beyond).toBeGreaterThan(0)
      expect(geometry.index.count).toBeGreaterThan(0)
      geometry.dispose()
    })

    it(`${townMap.id}: sem alcance, nada além da borda sul`, () => {
      const geometry = buildTownMapWaterGeometry(colliders, 1, SHORE, 0, DEEP)
      const position = geometry.getAttribute('position')
      const southEdge =
        colliders.ground.minZ +
        (colliders.ground.nz - 1) * colliders.ground.step
      for (let i = 0; i < position.count; i++) {
        expect(position.getZ(i)).toBeLessThanOrEqual(southEdge + 1e-6)
      }
      expect(geometry.index.count).toBeGreaterThan(0)
      geometry.dispose()
    })
  }
})
