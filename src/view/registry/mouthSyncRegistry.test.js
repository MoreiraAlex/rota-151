import { describe, it, expect } from 'vitest'
import {
  registerMouthSync,
  unregisterMouthSync,
  getMouthSync,
  getMouthSyncEntries,
} from './mouthSyncRegistry'

function fakeSync() {
  return {
    bones: { Head: {} },
    clip: { name: 'cry', bones: {} },
    elapsed: 0,
    wasPlaying: false,
  }
}

describe('mouthSyncRegistry', () => {
  it('registra e devolve a mesma entrada por entidade', () => {
    const entity = {}
    const sync = fakeSync()

    registerMouthSync(entity, sync)

    expect(getMouthSync(entity)).toBe(sync)

    unregisterMouthSync(entity)
  })

  it('desregistrar remove a entrada', () => {
    const entity = {}
    registerMouthSync(entity, fakeSync())

    unregisterMouthSync(entity)

    expect(getMouthSync(entity)).toBeUndefined()
  })

  it('desregistrar uma entidade nunca registrada não quebra', () => {
    expect(() => unregisterMouthSync({})).not.toThrow()
  })

  it('getMouthSyncEntries itera todas as entradas registradas', () => {
    const entityA = {}
    const entityB = {}
    registerMouthSync(entityA, fakeSync())
    registerMouthSync(entityB, fakeSync())

    const entities = [...getMouthSyncEntries()].map(([entity]) => entity)
    expect(entities).toContain(entityA)
    expect(entities).toContain(entityB)

    unregisterMouthSync(entityA)
    unregisterMouthSync(entityB)
  })
})
