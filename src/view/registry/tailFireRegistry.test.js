import { describe, it, expect } from 'vitest'
import {
  registerTailFire,
  unregisterTailFire,
  getTailFireEntry,
  getTailFireEntries,
} from './tailFireRegistry'

function fakeFlame() {
  return { group: {}, dispose: () => {} }
}

function fakeBone() {
  return { remove: () => {} }
}

describe('tailFireRegistry', () => {
  it('registra e devolve a mesma entrada por entidade', () => {
    const entity = {}
    const flame = fakeFlame()
    const bone = fakeBone()
    const config = { scale: 1, speed: 1 }

    registerTailFire(entity, flame, bone, config)

    expect(getTailFireEntry(entity)).toEqual({ flame, bone, config })

    unregisterTailFire(entity)
  })

  it('desregistrar remove o fogo do osso e descarta a chama', () => {
    const entity = {}
    let removed = null
    let disposed = false
    const flame = { group: {}, dispose: () => (disposed = true) }
    const bone = { remove: (group) => (removed = group) }

    registerTailFire(entity, flame, bone)
    unregisterTailFire(entity)

    expect(removed).toBe(flame.group)
    expect(disposed).toBe(true)
    expect(getTailFireEntry(entity)).toBeUndefined()
  })

  it('desregistrar uma entidade nunca registrada não quebra', () => {
    expect(() => unregisterTailFire({})).not.toThrow()
  })

  it('getTailFireEntries itera todas as entradas registradas', () => {
    const entityA = {}
    const entityB = {}
    registerTailFire(entityA, fakeFlame(), fakeBone())
    registerTailFire(entityB, fakeFlame(), fakeBone())

    const entities = [...getTailFireEntries()].map(([entity]) => entity)
    expect(entities).toContain(entityA)
    expect(entities).toContain(entityB)

    unregisterTailFire(entityA)
    unregisterTailFire(entityB)
  })
})
