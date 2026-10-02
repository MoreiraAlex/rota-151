import { describe, expect, it } from 'vitest'
import { GAME_CONFIG } from '@/core/gameConfig'
import { listSpecies, resolveSpeciesKind } from '@/core/data/species'
import { resolveCreatureStats } from '@/core/data/species/stats'
import { resolveCreatureAttack } from '@/core/battle/creatureAttack'
import {
  COMBAT_STAT_KEYS,
  findWikiSpecies,
  listWikiSpecies,
  resolveSpeciesAttacks,
  resolveSpeciesMoves,
  resolveStatRange,
  uniformIndividualValues,
} from './speciesEntry'

describe('listWikiSpecies', () => {
  it('traz só criaturas com status de batalha, em ordem de dex', () => {
    const species = listWikiSpecies()
    expect(species.length).toBeGreaterThan(0)
    for (const entry of species) {
      expect(resolveSpeciesKind(entry)).toBe('pokemon')
      expect(entry.stats.hp.base).not.toBeUndefined()
    }
    const dex = species.map((entry) => entry.dexNumber)
    expect(dex).toEqual([...dex].sort((a, b) => a - b))
  })

  it('não deixa de fora nenhuma criatura com status do registro', () => {
    const expected = listSpecies().filter(
      (entry) =>
        resolveSpeciesKind(entry) === 'pokemon' &&
        entry.stats?.hp?.base != null,
    )
    expect(listWikiSpecies()).toHaveLength(expected.length)
  })

  it('descarta treinador e espécie sem status num registro injetado', () => {
    const registry = {
      treinador: { id: 'treinador', kind: 'trainer', stats: { hp: {} } },
      vazia: { id: 'vazia', kind: 'pokemon', stats: {} },
      b: { id: 'b', kind: 'pokemon', dexNumber: 2, stats: { hp: { base: 1 } } },
      a: { id: 'a', kind: 'pokemon', dexNumber: 1, stats: { hp: { base: 1 } } },
    }
    expect(listWikiSpecies(registry).map((entry) => entry.id)).toEqual([
      'a',
      'b',
    ])
    expect(findWikiSpecies('treinador', registry)).toBeNull()
  })
})

describe('resolveStatRange', () => {
  it('a faixa vai do indivíduo de IV mínimo ao de IV máximo', () => {
    const { IV_MIN, IV_MAX } = GAME_CONFIG.BATTLE
    for (const species of listWikiSpecies()) {
      const range = resolveStatRange(species)
      const low = resolveCreatureStats(species, uniformIndividualValues(IV_MIN))
      const high = resolveCreatureStats(
        species,
        uniformIndividualValues(IV_MAX),
      )
      for (const key of COMBAT_STAT_KEYS) {
        expect(range.stats[key].base).toBe(species.stats[key].base)
        expect(range.stats[key].min).toBe(low[key].stat)
        expect(range.stats[key].max).toBe(high[key].stat)
        expect(range.stats[key].min).toBeLessThanOrEqual(range.stats[key].max)
      }
      expect(range.energy.min).toBe(low.energy.stat)
      expect(range.energy.max).toBe(high.energy.stat)
      expect(range.cp.min).toBeLessThanOrEqual(range.cp.max)
      expect(range.level).toBe(species.level)
    }
  })

  it('null pra espécie sem status', () => {
    expect(resolveStatRange({ id: 'x', stats: {} })).toBeNull()
  })
})

describe('resolveSpeciesAttacks', () => {
  it('um item por slot configurado, com faixas ordenadas', () => {
    for (const species of listWikiSpecies()) {
      const attacks = resolveSpeciesAttacks(species)
      for (const entry of attacks) {
        expect(resolveCreatureAttack(species, entry.slot)?.id).toBe(
          entry.attack.id,
        )
        expect(entry.cooldown.min).toBeLessThanOrEqual(entry.cooldown.max)
        expect(entry.duration.min).toBeLessThanOrEqual(entry.duration.max)
        expect(entry.staminaCost).toBeGreaterThanOrEqual(0)
      }
      const primary = attacks.find((entry) => entry.slot === 'primary')
      if (species.basicAttack) {
        // o básico não tem recarga — o ritmo vem da duração
        expect(primary.cooldown.max).toBe(0)
      }
    }
  })
})

describe('resolveSpeciesMoves', () => {
  it('resolve cada golpe de species.moves que existe no registro', () => {
    for (const species of listWikiSpecies()) {
      const moves = resolveSpeciesMoves(species)
      expect(moves.length).toBeLessThanOrEqual((species.moves ?? []).length)
      for (const move of moves) expect(move.id).toBeTruthy()
    }
  })
})
