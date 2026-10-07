import { afterEach, describe, expect, it } from 'vitest'
import { makeWorld, ownedByPlayer } from '@/test/makeWorld'
import { getItem, listItems } from '../data/items'
import {
  ActionState,
  ConsumeEffect,
  Eating,
  Fainted,
  HeldItem,
  Inventory,
  Position,
  Rotation,
  SummonedCreature,
  Vitals,
} from '../traits'
import { comecarAComer } from './eating'
import { resolveItemUseBlock, usarItemNaCriatura } from './itemUse'

const POTION = listItems().find((item) => item.category === 'consumable')
const BERRY = listItems().find((item) => item.category === 'berry')
const POKEBALL = listItems().find((item) => item.category === 'pokeball')

const worlds = []
afterEach(() => {
  while (worlds.length) worlds.pop().destroy()
})

function setup({ creatureHp = 10, counts = {} } = {}) {
  const made = makeWorld()
  worlds.push(made.world)
  const { world, player } = made
  player.set(Inventory, { counts, positions: {} })
  const creature = world.spawn(
    SummonedCreature({ slot: 'slot1', speciesId: 'bulbasaur' }),
    ...ownedByPlayer(world),
    Position,
    Rotation,
    ActionState,
    Vitals({ hp: creatureHp, maxHp: 1000 }),
  )
  return { world, player, creature }
}

describe('usarItemNaCriatura', () => {
  it('poção cura a criatura invocada na hora e gasta uma unidade', () => {
    const { world, player, creature } = setup({ counts: { [POTION.id]: 2 } })

    expect(usarItemNaCriatura(world, player, 'slot1', POTION.id)).toBe(true)

    expect(creature.get(Vitals).hp).toBe(10 + POTION.consumable.healAmount)
    expect(player.get(Inventory).counts[POTION.id]).toBe(1)
    expect(world.query(ConsumeEffect).length).toBe(1)
  })

  it('fruta: a criatura começa a comer e a unidade é gasta', () => {
    const { world, player, creature } = setup({ counts: { [BERRY.id]: 1 } })

    expect(usarItemNaCriatura(world, player, 'slot1', BERRY.id)).toBe(true)

    expect(creature.get(ActionState).current).toBe('eat')
    expect(creature.get(Eating).itemId).toBe(BERRY.id)
    expect(player.get(Inventory).counts[BERRY.id]).toBeUndefined()
  })

  it('usar a última unidade, que estava na mão, desequipa a mão', () => {
    const { world, player } = setup({ counts: { [POTION.id]: 1 } })
    player.set(HeldItem, { itemId: POTION.id })

    usarItemNaCriatura(world, player, 'slot1', POTION.id)

    expect(player.get(HeldItem).itemId).toBe(null)
  })

  it('sem a criatura do slot invocada, não usa', () => {
    const { world, player } = setup({ counts: { [POTION.id]: 1 } })

    expect(resolveItemUseBlock(world, player, 'slot2', POTION.id)).toBe(
      'not-summoned',
    )
    expect(usarItemNaCriatura(world, player, 'slot2', POTION.id)).toBe(false)
    expect(player.get(Inventory).counts[POTION.id]).toBe(1)
  })

  it('desmaiada ou com a vida cheia, não usa nem gasta', () => {
    const fainted = setup({ counts: { [POTION.id]: 1 } })
    fainted.creature.add(Fainted)
    expect(
      resolveItemUseBlock(fainted.world, fainted.player, 'slot1', POTION.id),
    ).toBe('fainted')

    const full = setup({ creatureHp: 1000, counts: { [POTION.id]: 1 } })
    expect(
      usarItemNaCriatura(full.world, full.player, 'slot1', POTION.id),
    ).toBe(false)
    expect(full.player.get(Inventory).counts[POTION.id]).toBe(1)
  })

  it('a criatura já comendo não recebe outra fruta, mas recebe poção', () => {
    const { world, player, creature } = setup({
      counts: { [BERRY.id]: 1, [POTION.id]: 1 },
    })
    comecarAComer(creature, BERRY)

    expect(resolveItemUseBlock(world, player, 'slot1', BERRY.id)).toBe('eating')
    expect(usarItemNaCriatura(world, player, 'slot1', POTION.id)).toBe(true)
  })

  it('o treinador comendo não usa item na criatura', () => {
    const { world, player } = setup({ counts: { [POTION.id]: 1 } })
    const vitals = player.get(Vitals)
    player.set(Vitals, { ...vitals, hp: vitals.maxHp / 2 })
    comecarAComer(player, BERRY)

    expect(resolveItemUseBlock(world, player, 'slot1', POTION.id)).toBe(
      'trainer-eating',
    )
  })

  it('sem o item, ou item que não é de usar em Pokémon, não usa', () => {
    const { world, player } = setup({ counts: { [POKEBALL.id]: 1 } })

    expect(resolveItemUseBlock(world, player, 'slot1', POTION.id)).toBe(
      'no-item',
    )
    expect(resolveItemUseBlock(world, player, 'slot1', POKEBALL.id)).toBe(
      'no-item',
    )
    expect(getItem(POKEBALL.id)).toBeTruthy()
  })
})
