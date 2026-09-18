import { describe, it, expect } from 'vitest'
import {
  registerEyeBlink,
  unregisterEyeBlink,
  getEyeBlinkUnits,
  getEyeBlinkEntries,
} from './eyeBlinkRegistry'

function fakeUnits() {
  return [
    {
      texture: {},
      repeat: { x: 0.25, y: 0.25 },
      states: { awake: { open: { x: 0, y: 0 }, closed: { x: 0.25, y: 0 } } },
      blink: { minInterval: 2, maxInterval: 6, closedDuration: 0.12 },
      phase: 'open',
      timer: 3,
      lastMood: 'awake',
    },
  ]
}

describe('eyeBlinkRegistry', () => {
  it('registra e devolve a mesma lista de unidades por entidade', () => {
    const entity = {}
    const units = fakeUnits()

    registerEyeBlink(entity, units)

    expect(getEyeBlinkUnits(entity)).toBe(units)

    unregisterEyeBlink(entity)
  })

  it('desregistrar remove a entrada', () => {
    const entity = {}
    registerEyeBlink(entity, fakeUnits())

    unregisterEyeBlink(entity)

    expect(getEyeBlinkUnits(entity)).toBeUndefined()
  })

  it('desregistrar uma entidade nunca registrada não quebra', () => {
    expect(() => unregisterEyeBlink({})).not.toThrow()
  })

  it('getEyeBlinkEntries itera todas as entradas registradas', () => {
    const entityA = {}
    const entityB = {}
    registerEyeBlink(entityA, fakeUnits())
    registerEyeBlink(entityB, fakeUnits())

    const entities = [...getEyeBlinkEntries()].map(([entity]) => entity)
    expect(entities).toContain(entityA)
    expect(entities).toContain(entityB)

    unregisterEyeBlink(entityA)
    unregisterEyeBlink(entityB)
  })
})
