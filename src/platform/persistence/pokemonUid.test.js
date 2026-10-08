import { describe, expect, it } from 'vitest'
import { createPokemonUid } from './pokemonUid'

const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

describe('createPokemonUid', () => {
  it('usa o randomUUID quando existe', () => {
    expect(createPokemonUid({ randomUUID: () => 'id' })).toBe('id')
  })

  it('sem randomUUID, monta um UUID v4 com getRandomValues', () => {
    const crypto = {
      getRandomValues: (bytes) => globalThis.crypto.getRandomValues(bytes),
    }
    const first = createPokemonUid(crypto)
    expect(first).toMatch(UUID_V4)
    expect(createPokemonUid(crypto)).not.toBe(first)
  })
})
