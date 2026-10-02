import { describe, it, expect } from 'vitest'
import {
  getSpecies,
  listSpecies,
  resolveSpeciesKind,
  SPECIES_REGISTRY,
} from './index'

const FAKE_REGISTRY = {
  bulbasaur: { id: 'bulbasaur', dexNumber: 1 },
  charmander: { id: 'charmander', dexNumber: 4 },
}

describe('species registry — mecanismo', () => {
  it('getSpecies acha pelo id', () => {
    expect(getSpecies('bulbasaur', FAKE_REGISTRY)).toEqual(
      FAKE_REGISTRY.bulbasaur,
    )
  })

  it('getSpecies devolve null pra id desconhecido', () => {
    expect(getSpecies('nao-existe', FAKE_REGISTRY)).toBeNull()
  })

  it('listSpecies devolve todas as entradas como array', () => {
    const list = listSpecies(FAKE_REGISTRY)
    expect(list).toHaveLength(2)
    expect(list).toContainEqual(FAKE_REGISTRY.charmander)
  })

  it('sem argumento, usa o SPECIES_REGISTRY real (começa vazio — é conteúdo do usuário)', () => {
    expect(listSpecies()).toEqual(Object.values(SPECIES_REGISTRY))
  })

  it('resolveSpeciesKind lê o kind da espécie', () => {
    expect(resolveSpeciesKind({ kind: 'pokemon' })).toBe('pokemon')
    expect(resolveSpeciesKind({ kind: 'trainer' })).toBe('trainer')
  })

  it('resolveSpeciesKind assume trainer quando a espécie não tem kind', () => {
    expect(resolveSpeciesKind({})).toBe('trainer')
    expect(resolveSpeciesKind(null)).toBe('trainer')
  })
})
