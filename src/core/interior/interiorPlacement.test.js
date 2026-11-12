import { describe, expect, it } from 'vitest'
import { GAME_CONFIG } from '../gameConfig'
import { listInteriors } from '../data/interiors'
import { BUILDING_KIND, STREET_PROP_KIND, modelBoxOf } from '../town/townPlan'
import {
  doorOf,
  interiorCameraFocus,
  interiorOrigin,
  interiorToWorld,
  nearestDoor,
  outsideSpot,
} from './interiorPlacement'

// Onde ficam as portas e as salas (docs/features/068-interior-dos-
// predios.md). Os prédios saem da própria lista de salas: nada de modelo
// fixo.
const [interior] = listInteriors()

const building = (overrides = {}) => ({
  kind: BUILDING_KIND,
  model: interior.building,
  x: 10,
  y: 4,
  z: -20,
  yaw: 0,
  scale: 1.5,
  ...overrides,
})

const facingOf = (yaw) => ({ x: Math.sin(yaw), z: Math.cos(yaw) })

describe('doorOf', () => {
  it('só prédio com sala por dentro tem porta', () => {
    expect(doorOf(building({ kind: STREET_PROP_KIND }))).toBeNull()
    expect(doorOf(building({ model: 'modelo-sem-sala' }))).toBeNull()
    expect(doorOf(building())).toMatchObject({ interiorId: interior.id })
  })

  it('fica na frente do prédio, na borda da caixa dele, para qualquer giro', () => {
    for (const yaw of [0, Math.PI / 2, Math.PI, -0.7]) {
      const placed = building({ yaw })
      const door = doorOf(placed)
      const facing = facingOf(yaw)
      const ahead =
        (door.x - placed.x) * facing.x + (door.z - placed.z) * facing.z
      expect(ahead).toBeCloseTo(modelBoxOf(placed.model)[3] * placed.scale, 6)
      expect(door.yaw).toBe(yaw)
      expect(door.scale).toBe(placed.scale)
      expect(door.y).toBe(placed.y)
    }
  })
})

describe('outsideSpot', () => {
  it('à frente da porta, virado para fora, na distância pedida', () => {
    const door = doorOf(building({ yaw: 1.1 }))
    const spot = outsideSpot(door, 3)
    const facing = facingOf(door.yaw)
    expect(
      (spot.x - door.x) * facing.x + (spot.z - door.z) * facing.z,
    ).toBeCloseTo(3, 6)
    expect(spot.yaw).toBe(door.yaw)
  })

  it('sem distância, usa a da config', () => {
    const door = doorOf(building())
    const spot = outsideSpot(door)
    expect(Math.hypot(spot.x - door.x, spot.z - door.z)).toBeCloseTo(
      GAME_CONFIG.INTERIOR.EXIT_DISTANCE,
      6,
    )
  })
})

describe('interiorOrigin / interiorToWorld', () => {
  it('a sala fica acima da porta, na altura da config', () => {
    const door = doorOf(building())
    const origin = interiorOrigin(door)
    expect(origin.x).toBe(door.x)
    expect(origin.z).toBe(door.z)
    expect(origin.y - door.y).toBe(GAME_CONFIG.INTERIOR.ALTITUDE)
  })

  it('um ponto da sala vai para o mundo na escala dela, sem giro', () => {
    const place = { x: 1, y: 2, z: 3, scale: 2 }
    expect(interiorToWorld(place, { x: 1, y: 0.5, z: -2 })).toEqual({
      x: 3,
      y: 3,
      z: -1,
    })
    expect(interiorToWorld(place, { x: 0, z: 0 }).y).toBe(place.y)
  })
})

describe('nearestDoor', () => {
  it('a porta mais perto ao alcance; longe demais, nenhuma', () => {
    const near = building({ x: 0, z: 0 })
    const far = building({ x: 40, z: 0 })
    const from = doorOf(near)
    const found = nearestDoor([far, near], from, 1)
    expect(found.door).toEqual(doorOf(near))
    expect(found.distance).toBeCloseTo(0, 6)
    expect(nearestDoor([far], from, 1)).toBeNull()
  })

  it('ignora o que não tem porta', () => {
    const prop = building({ kind: STREET_PROP_KIND, x: 0, z: 0 })
    expect(nearestDoor([prop], { x: 0, z: 0 }, 100)).toBeNull()
  })
})

describe('interiorCameraFocus', () => {
  it('do meio da sala até o treinador, na fração pedida', () => {
    const place = { x: 5, y: 300, z: -2, scale: 1.5 }
    const position = { x: 20, y: 301, z: 7 }
    expect(interiorCameraFocus(interior, place, position, 1)).toEqual(position)
    const center = interiorCameraFocus(interior, place, position, 0)
    const half = interiorCameraFocus(interior, place, position, 0.5)
    expect(half.x).toBeCloseTo((center.x + position.x) / 2, 6)
    expect(half.z).toBeCloseTo((center.z + position.z) / 2, 6)
    expect(half.y).toBe(position.y)
  })
})
