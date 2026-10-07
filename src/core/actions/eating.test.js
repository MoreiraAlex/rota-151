import { afterEach, describe, expect, it } from 'vitest'
import { createWorld } from 'koota'
import { listItems } from '../data/items'
import { GAME_CONFIG } from '../gameConfig'
import {
  ActionState,
  CharacterController,
  DroppedFood,
  Eating,
  Fainted,
  Position,
  Rotation,
  Velocity,
  Vitals,
} from '../traits'
import {
  comecarAComer,
  derrubarComida,
  isEating,
  podeComer,
  terminarDeComer,
} from './eating'
import { desmaiar } from './faint'

const BERRY = listItems().find((item) => item.category === 'berry')

const worlds = []
afterEach(() => {
  while (worlds.length) worlds.pop().destroy()
})

function setup({ hp = 50, maxHp = 100 } = {}) {
  const world = createWorld()
  worlds.push(world)
  const eater = world.spawn(
    Position({ x: 1, y: 2, z: 3 }),
    Rotation,
    ActionState,
    CharacterController,
    Vitals({ hp, maxHp }),
  )
  return { world, eater }
}

describe('comer — actions', () => {
  it('começa a comer: ação `eat` e `Eating` com os dados da fruta', () => {
    const { eater } = setup()

    expect(comecarAComer(eater, BERRY)).toBe(true)

    expect(isEating(eater)).toBe(true)
    expect(eater.get(Eating)).toMatchObject({
      itemId: BERRY.id,
      duration: BERRY.berry.duration,
      healTotal: BERRY.berry.healAmount,
      healed: 0,
    })
  })

  it('não começa com a vida cheia, desmaiada, ocupada ou já comendo', () => {
    const full = setup({ hp: 100 }).eater
    expect(podeComer(full)).toBe(false)

    const fainted = setup().eater
    fainted.add(Fainted)
    expect(podeComer(fainted)).toBe(false)

    const busy = setup().eater
    busy.set(ActionState, { current: 'attack' })
    expect(comecarAComer(busy, BERRY)).toBe(false)
    expect(busy.has(Eating)).toBe(false)

    const eating = setup().eater
    comecarAComer(eating, BERRY)
    expect(comecarAComer(eating, BERRY)).toBe(false)
  })

  it('item que não é fruta não começa', () => {
    const { eater } = setup()
    const potion = listItems().find((item) => item.category === 'consumable')

    expect(comecarAComer(eater, potion)).toBe(false)
    expect(isEating(eater)).toBe(false)
  })

  it('terminar de comer libera a ação e tira o `Eating`', () => {
    const { eater } = setup()
    comecarAComer(eater, BERRY)

    terminarDeComer(eater)

    expect(eater.get(ActionState).current).toBe(null)
    expect(eater.has(Eating)).toBe(false)
  })

  it('derrubar: a fruta sai à frente, jogada pra cima, e a ação acaba', () => {
    const { world, eater } = setup()
    comecarAComer(eater, BERRY)

    expect(derrubarComida(world, eater)).toBe(true)

    expect(isEating(eater)).toBe(false)
    expect(eater.has(Eating)).toBe(false)
    const foods = world.query(DroppedFood)
    expect(foods.length).toBe(1)
    const food = foods[0]
    expect(food.get(DroppedFood)).toMatchObject({
      itemId: BERRY.id,
      lifetime: GAME_CONFIG.ITEMS.DROPPED_FOOD_LIFETIME,
      eaten: 0,
    })
    const pos = food.get(Position)
    // Rotação 0: "frente" é +z — sai à frente e é jogada pra frente e pra cima.
    expect(pos.z).toBeGreaterThan(eater.get(Position).z)
    expect(food.get(Velocity).z).toBeGreaterThan(0)
    expect(food.get(Velocity).y).toBeGreaterThan(0)
    // O chão é o de quem comia (o pé, abaixo do centro da cápsula).
    expect(food.get(DroppedFood).floorY).toBeLessThan(eater.get(Position).y)
  })

  it('derrubar sem estar comendo não faz nada', () => {
    const { world, eater } = setup()

    expect(derrubarComida(world, eater)).toBe(false)
    expect(world.query(DroppedFood).length).toBe(0)
  })

  it('desmaiar comendo derruba a comida', () => {
    const { world, eater } = setup()
    comecarAComer(eater, BERRY)

    desmaiar(world, eater)

    expect(eater.has(Eating)).toBe(false)
    expect(world.query(DroppedFood).length).toBe(1)
  })

  it('a fruta caída guarda quanto já tinha sido comido', () => {
    const { world, eater } = setup()
    comecarAComer(eater, BERRY)
    const eating = eater.get(Eating)
    eater.set(Eating, { ...eating, healed: eating.healTotal / 2 })

    derrubarComida(world, eater)

    expect(world.query(DroppedFood)[0].get(DroppedFood).eaten).toBeCloseTo(0.5)
  })
})
