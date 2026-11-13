import { describe, expect, it } from 'vitest'
import { getTownMap, listTownMaps, townMapCollidersOf } from '../data/townMaps'
import { GAME_CONFIG } from '../gameConfig'
import {
  isInsideTownMap,
  townMapArrival,
  townMapGroundAt,
  townMapPlace,
  townMapScale,
  townMapSurfaceAt,
  townMapToWorld,
  townMapWaterDepthAt,
  townMapWaterSurface,
} from './townMapPlacement'

// O mapa de uma cidade copiada (docs/features/069-revisao-do-bioma-
// cidade.md — Pallet): regras do lugar e das consultas, para qualquer
// mapa da lista.
const PLACE = { x: 120, y: 700, z: -45, scale: 1.5 }

// Um ponto da grade do chão (`ix`, `iz`) no mundo, com o mapa em `place`.
function gridPoint(colliders, place, ix, iz) {
  const { ground } = colliders
  return townMapToWorld(place, {
    x: ground.minX + ix * ground.step,
    z: ground.minZ + iz * ground.step,
  })
}

describe('townMapScale', () => {
  it('sem tamanho próprio, é o dos prédios da cidade', () => {
    expect(townMapScale({ SCALE: null }, { town: { scale: 1.7 } })).toBe(1.7)
  })

  it('com tamanho próprio, é ele', () => {
    expect(townMapScale({ SCALE: 2 }, { town: { scale: 1.7 } })).toBe(2)
  })
})

describe('townMapPlace', () => {
  it('fica no mesmo XZ, a altitude acima do relevo de lá', () => {
    const place = townMapPlace({ x: 10, z: -4 }, 37, 1.2, 500)
    expect(place).toEqual({ x: 10, y: 537, z: -4, scale: 1.2 })
  })
})

describe.each(listTownMaps().map((townMap) => [townMap.id, townMap]))(
  'o mapa %s',
  (_, townMap) => {
    const colliders = townMapCollidersOf(townMap)
    const { ground } = colliders

    it('se acha pelo id', () => {
      expect(getTownMap(townMap.id)).toBe(townMap)
    })

    it('o chão na grade é a altura dela, na escala e no lugar', () => {
      for (const [ix, iz] of [
        [0, 0],
        [Math.floor(ground.nx / 2), Math.floor(ground.nz / 3)],
        [ground.nx - 1, ground.nz - 1],
      ]) {
        const point = gridPoint(colliders, PLACE, ix, iz)
        const expected =
          PLACE.y + ground.heights[iz + ix * ground.nz] * PLACE.scale
        expect(townMapGroundAt(colliders, PLACE, point.x, point.z)).toBeCloseTo(
          expected,
          4,
        )
      }
    })

    it('dentro da caixa no meio, fora dela longe', () => {
      expect(isInsideTownMap(colliders, PLACE, PLACE.x, PLACE.z)).toBe(true)
      const far = (colliders.box[3] + 10) * PLACE.scale
      expect(isInsideTownMap(colliders, PLACE, PLACE.x + far, PLACE.z)).toBe(
        false,
      )
    })

    it('água só onde o mar cobre, e funda onde o chão fica abaixo dela', () => {
      let wet = 0
      for (let ix = 0; ix < ground.nx; ix += 3) {
        for (let iz = 0; iz < ground.nz; iz += 3) {
          const point = gridPoint(colliders, PLACE, ix, iz)
          const depth = townMapWaterDepthAt(colliders, PLACE, point.x, point.z)
          const covered = colliders.water?.cells[iz + ix * ground.nz] === '1'
          if (!covered) expect(depth).toBe(0)
          else {
            const surface = townMapWaterSurface(colliders, PLACE)
            const floor = townMapGroundAt(colliders, PLACE, point.x, point.z)
            expect(depth).toBeCloseTo(surface - floor, 6)
            if (depth > 0) wet++
          }
        }
      }
      if (colliders.water) expect(wet).toBeGreaterThan(0)
    })

    it('a chegada fica no mapa, em chão seco, longe das paredes', () => {
      const arrival = townMapArrival(colliders, PLACE)
      expect(isInsideTownMap(colliders, PLACE, arrival.x, arrival.z)).toBe(true)
      expect(
        townMapWaterDepthAt(colliders, PLACE, arrival.x, arrival.z),
      ).toBeLessThanOrEqual(0)
      // No chão ou num degrau que o treinador sobe sozinho (a soleira da
      // porta).
      const ground = townMapGroundAt(colliders, PLACE, arrival.x, arrival.z)
      expect(arrival.y).toBeGreaterThan(ground - 0.05)
      expect(arrival.y - ground).toBeLessThan(
        GAME_CONFIG.PHYSICS.CHARACTER.AUTOSTEP_HEIGHT,
      )
      const local = colliders.arrival
      for (const { box } of colliders.boxes) {
        const isIn =
          local.x > box[0] &&
          local.x < box[3] &&
          local.z > box[2] &&
          local.z < box[5]
        expect(isIn).toBe(false)
      }
    })

    it('o chão é grama ou não em cada ponto', () => {
      const point = gridPoint(colliders, PLACE, 1, 1)
      expect(['grass', 'ground']).toContain(
        townMapSurfaceAt(colliders, PLACE, point.x, point.z),
      )
    })

    it('as grades têm um valor por ponto e as caixas não são vazias', () => {
      const count = ground.nx * ground.nz
      expect(ground.heights).toHaveLength(count)
      expect(ground.grass).toHaveLength(count)
      if (colliders.water) expect(colliders.water.cells).toHaveLength(count)
      for (const { box } of colliders.boxes) {
        expect(box[3]).toBeGreaterThan(box[0])
        expect(box[4]).toBeGreaterThan(box[1])
        expect(box[5]).toBeGreaterThan(box[2])
      }
    })
  },
)
