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

  it('itens de teste reais têm a categoria esperada', () => {
    expect(getItem('pebble').category).toBe('throwable')
    expect(getItem('potion').category).toBe('consumable')
  })

  it('kit de teste tem 10 throwable e 5 consumable', () => {
    const list = listItems()
    expect(list.filter((item) => item.category === 'throwable')).toHaveLength(
      10,
    )
    expect(list.filter((item) => item.category === 'consumable')).toHaveLength(
      5,
    )
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
