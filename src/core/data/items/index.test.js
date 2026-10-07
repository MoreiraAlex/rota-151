import { describe, it, expect } from 'vitest'
import {
  getItem,
  listItems,
  ITEM_REGISTRY,
  ITEM_CATEGORY_ORDER,
  DEFAULT_POKEBALL_ID,
  isStackableItem,
} from './index'

const FAKE_REGISTRY = {
  a: { id: 'a', category: 'throwable' },
  b: { id: 'b', category: 'consumable' },
}

describe('item registry — mecanismo', () => {
  it('getItem acha pelo id', () => {
    expect(getItem('a', FAKE_REGISTRY)).toEqual(FAKE_REGISTRY.a)
  })

  it('getItem devolve null pra id desconhecido', () => {
    expect(getItem('nao-existe', FAKE_REGISTRY)).toBeNull()
  })

  it('listItems devolve todas as entradas como array', () => {
    const list = listItems(FAKE_REGISTRY)
    expect(list).toHaveLength(2)
    expect(list).toContainEqual(FAKE_REGISTRY.b)
  })

  it('sem argumento, usa o ITEM_REGISTRY real', () => {
    expect(listItems()).toEqual(Object.values(ITEM_REGISTRY))
  })
})

// Sem conteúdo fixo (o catálogo muda): só as regras que valem pra qualquer item.
describe('item registry — catálogo', () => {
  it('a chave do registro é o id do item', () => {
    for (const [key, item] of Object.entries(ITEM_REGISTRY)) {
      expect(item.id).toBe(key)
    }
  })

  it('todo item tem nome, descrição e uma categoria da ordem do inventário', () => {
    for (const item of listItems()) {
      expect(item.name, item.id).toBeTruthy()
      expect(item.description, item.id).toBeTruthy()
      expect(ITEM_CATEGORY_ORDER, item.id).toContain(item.category)
    }
  })

  it('toda poção tem cura configurada', () => {
    for (const item of listItems().filter((i) => i.category === 'consumable')) {
      expect(item.consumable?.healAmount, item.id).toBeGreaterThan(0)
    }
  })

  it('toda fruta tem cura e duração configuradas', () => {
    for (const item of listItems().filter((i) => i.category === 'berry')) {
      expect(item.berry?.healAmount, item.id).toBeGreaterThan(0)
      expect(item.berry?.duration, item.id).toBeGreaterThan(0)
    }
  })

  it('toda Pokébola tem multiplicador de captura', () => {
    for (const item of listItems().filter((i) => i.category === 'pokeball')) {
      expect(item.pokeball?.captureMultiplier, item.id).toBeGreaterThan(0)
    }
  })

  it('a Pokébola padrão (dos iniciais) existe e é uma Pokébola', () => {
    expect(getItem(DEFAULT_POKEBALL_ID)?.category).toBe('pokeball')
  })

  it('item acumula, a não ser que diga `stackable: false`', () => {
    expect(isStackableItem({ id: 'a' })).toBe(true)
    expect(isStackableItem({ id: 'b', stackable: false })).toBe(false)
  })
})
