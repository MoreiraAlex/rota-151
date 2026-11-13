import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import {
  assignLampSlots,
  glowCenterOf,
  lampKeyOf,
  nearestLampLights,
} from './lampLights'

// docs/features/069-revisao-do-bioma-cidade.md
const box = (x, y, z) => new THREE.BoxGeometry(0.2, 0.2, 0.2).translate(x, y, z)
const lamp = {
  parts: [
    { geometry: box(0, 1, 0), glow: false },
    { geometry: box(0.5, 2.5, 0), glow: true },
  ],
}
const bench = { parts: [{ geometry: box(0, 0.3, 0), glow: false }] }
const models = { lamp, bench }
const placed = (model, x, z, extra = {}) => ({
  model,
  x,
  y: 1,
  z,
  yaw: 0,
  scale: 2,
  ...extra,
})

describe('glowCenterOf', () => {
  it('o meio das partes que acendem; sem elas, nada', () => {
    const center = glowCenterOf(lamp)
    expect(center.x).toBeCloseTo(0.5)
    expect(center.y).toBeCloseTo(2.5)
    expect(center.z).toBeCloseTo(0)
    expect(glowCenterOf(bench)).toBeNull()
    expect(glowCenterOf(undefined)).toBeNull()
  })
})

describe('nearestLampLights', () => {
  const chunks = [
    {
      solids: {
        buildings: [
          placed('lamp', 10, 0),
          placed('bench', 1, 0),
          placed('lamp', 3, 0),
        ],
      },
    },
    { solids: { buildings: [placed('lamp', -6, 0)] } },
    {},
  ]

  it('só os postes, do mais perto ao mais longe, até `count`', () => {
    const found = nearestLampLights(chunks, models, { x: 0, z: 0 }, 2)
    expect(found).toHaveLength(2)
    expect(found[0].distance).toBeLessThan(found[1].distance)
    // O vidro do poste mais perto, no tamanho e na altura dele.
    const center = glowCenterOf(lamp)
    expect(found[0].x).toBeCloseTo(3 + center.x * 2)
    expect(found[0].y).toBeCloseTo(1 + center.y * 2)
  })

  it('o vidro gira com o poste', () => {
    const turned = [
      { solids: { buildings: [placed('lamp', 0, 0, { yaw: Math.PI / 2 })] } },
    ]
    const [light] = nearestLampLights(turned, models, { x: 0, z: 0 }, 1)
    const center = glowCenterOf(lamp)
    // Um quarto de volta: o +X do modelo vai para o -Z do mundo.
    expect(light.x).toBeCloseTo(center.z * 2)
    expect(light.z).toBeCloseTo(-center.x * 2)
  })
})

describe('assignLampSlots', () => {
  const at = (x, z) => ({ x, y: 0, z })
  const empty = (count) =>
    Array.from({ length: count }, () => ({ lamp: null, level: 0 }))
  const keysOf = (slots) =>
    slots.map(({ lamp }) => (lamp ? lampKeyOf(lamp) : null))

  it('as livres pegam os postes, acendendo do zero', () => {
    const lamps = [at(1, 0), at(2, 0)]
    const slots = assignLampSlots(empty(3), lamps)
    expect(keysOf(slots).filter(Boolean).sort()).toEqual(
      lamps.map(lampKeyOf).sort(),
    )
    for (const slot of slots.filter(({ lamp }) => lamp)) {
      expect(slot).toMatchObject({ level: 0, target: 1 })
    }
  })

  it('a luz fica no poste dela enquanto ele segue entre os escolhidos', () => {
    const first = assignLampSlots(empty(2), [at(1, 0), at(2, 0)]).map(
      (slot) => ({ ...slot, level: 1 }),
    )
    // A mesma lista em outra ordem não troca ninguém de lugar.
    const again = assignLampSlots(first, [at(2, 0), at(1, 0)])
    expect(keysOf(again)).toEqual(keysOf(first))
    expect(again.every(({ level }) => level === 1)).toBe(true)
  })

  it('a que perde o poste apaga antes de ir para outro', () => {
    const lit = assignLampSlots(empty(1), [at(1, 0)]).map((slot) => ({
      ...slot,
      level: 1,
    }))
    const leaving = assignLampSlots(lit, [at(5, 0)])
    expect(keysOf(leaving)).toEqual(keysOf(lit))
    expect(leaving[0].target).toBe(0)
    const off = assignLampSlots(
      leaving.map((slot) => ({ ...slot, level: 0 })),
      [at(5, 0)],
    )
    expect(keysOf(off)).toEqual([lampKeyOf(at(5, 0))])
    expect(off[0]).toMatchObject({ level: 0, target: 1 })
  })
})
