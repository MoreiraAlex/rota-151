import { describe, expect, it } from 'vitest'
import { Prisma } from '@prisma/client'
import { pokemonToRow, rowsToSave } from './saveRepository'

// Tradução save ↔ linhas do banco (docs/features/044-salvar-o-jogo.md). A
// gravação em si (transação no Postgres) é verificada no jogo.
const SAVED_POKEMON = {
  id: 'p1',
  speciesId: 'x',
  ballId: null,
  level: 3,
  xp: 10,
  ivs: { hp: 1 },
  moves: { slots: { 1: null }, training: {} },
  storedVitals: null,
  faintTimeLeft: null,
  conditions: null,
  location: { kind: 'party', slot: 'slot1' },
}

describe('saveRepository', () => {
  it('ida e volta de um Pokémon pelas colunas', () => {
    const row = { id: SAVED_POKEMON.id, ...pokemonToRow(SAVED_POKEMON) }
    // O banco devolve null onde gravou DbNull.
    row.storedVitals = null
    row.conditions = null

    const save = rowsToSave({
      saveVersion: 1,
      heldItemId: null,
      inventory: {},
      pokedex: {},
      pokemon: [row],
    })

    expect(save.pokemon).toEqual([SAVED_POKEMON])
  })

  it('Json nulo vira DbNull (coluna NULL, não JSON null)', () => {
    const row = pokemonToRow(SAVED_POKEMON)
    expect(row.storedVitals).toBe(Prisma.DbNull)
    expect(row.conditions).toBe(Prisma.DbNull)
  })

  it('o treinador vira a parte trainer, com a versão', () => {
    const save = rowsToSave({
      saveVersion: 7,
      heldItemId: 'a',
      inventory: { counts: {} },
      pokedex: { speciesIds: [] },
      pokemon: [],
    })
    expect(save).toEqual({
      version: 7,
      trainer: {
        heldItemId: 'a',
        inventory: { counts: {} },
        pokedex: { speciesIds: [] },
      },
      pokemon: [],
    })
  })
})
