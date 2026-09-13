import { describe, it, expect } from 'vitest'
import { getSpecies, listSpecies, SPECIES_REGISTRY } from './index'

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
})
