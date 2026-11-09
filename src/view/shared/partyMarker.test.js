import { afterEach, describe, expect, it } from 'vitest'
import { createWorld } from 'koota'
import {
  OwnedBy,
  PARTY_SLOT_IDS,
  Party,
  SummonedCreature,
  WildCreature,
} from '@/core/traits'
import { resolveMineSlotKey } from './partyMarker'

// A marca de "seu" (docs/features/064-revisao-da-ia-do-parceiro.md, Parte 4).
const worlds = []
afterEach(() => {
  while (worlds.length) worlds.pop().destroy()
})

function setup() {
  const world = createWorld()
  worlds.push(world)
  return { world, me: world.spawn(Party), other: world.spawn(Party) }
}

describe('resolveMineSlotKey', () => {
  it('sua criatura ganha uma tecla por slot, cada slot a sua', () => {
    const { world, me } = setup()
    const keys = PARTY_SLOT_IDS.map((slot) =>
      resolveMineSlotKey(
        world.spawn(
          SummonedCreature({ slot, speciesId: 'pidgey' }),
          OwnedBy(me),
        ),
        me,
      ),
    )
    for (const key of keys) expect(key).toEqual(expect.any(String))
    expect(new Set(keys).size).toBe(PARTY_SLOT_IDS.length)
  })

  it('selvagem, treinador e criatura de outro treinador não ganham', () => {
    const { world, me, other } = setup()
    const wild = world.spawn(WildCreature({ speciesId: 'pidgey' }))
    const theirs = world.spawn(
      SummonedCreature({ slot: 'slot1', speciesId: 'pidgey' }),
      OwnedBy(other),
    )
    expect(resolveMineSlotKey(wild, me)).toBeNull()
    expect(resolveMineSlotKey(me, me)).toBeNull()
    expect(resolveMineSlotKey(theirs, me)).toBeNull()
  })
})
