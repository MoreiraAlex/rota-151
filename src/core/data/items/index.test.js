import { describe, it, expect } from 'vitest'
import { getItem, listItems, ITEM_REGISTRY } from './index'

const FAKE_REGISTRY = {
  rock: { id: 'rock', category: 'throwable' },
  elixir: { id: 'elixir', category: 'consumable' },
}

describe('item registry — mecanismo', () => {
  it('getItem acha pelo id', () => {
    expect(getItem('rock', FAKE_REGISTRY)).toEqual(FAKE_REGISTRY.rock)
  })

  it('getItem devolve null pra id desconhecido', () => {
    expect(getItem('nao-existe', FAKE_REGISTRY)).toBeNull()
  })

  it('listItems devolve todas as entradas como array', () => {
    const list = listItems(FAKE_REGISTRY)
    expect(list).toHaveLength(2)
    expect(list).toContainEqual(FAKE_REGISTRY.elixir)
  })

  it('sem argumento, usa o ITEM_REGISTRY real', () => {
    expect(listItems()).toEqual(Object.values(ITEM_REGISTRY))
  })

  // Sem conteúdo fixo (o kit muda): só as regras que valem pra qualquer item.
  it('todo item do registro tem uma categoria conhecida', () => {
    for (const item of listItems()) {
      expect(['throwable', 'consumable', 'scanner'], item.id).toContain(
        item.category,
      )
    }
  })

  it('todo consumable de teste tem healAmount configurado', () => {
    const consumables = listItems().filter(
      (item) => item.category === 'consumable',
    )
    for (const item of consumables) {
      expect(item.consumable?.healAmount).toBeGreaterThan(0)
    }
  })
})
