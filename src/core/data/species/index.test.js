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

describe('paralisado (estado `stunned`) em toda espécie', () => {
  it('tem o que tocar: a animação do modelo ou a camada sobre uma base que existe', () => {
    for (const species of listSpecies().filter((s) => s.kind === 'pokemon')) {
      const native = species.nativeAnimations?.stunned
      const layer = species.clips?.stunned
      const ok =
        Boolean(native) ||
        Boolean(layer?.base && species.nativeAnimations?.[layer.base])
      expect(ok, `${species.id} sem animação de paralisado`).toBe(true)
    }
  })
})
