import { afterEach, describe, expect, it } from 'vitest'
import { createWorld } from 'koota'
import { comecarAComer } from '../actions/eating'
import { listItems } from '../data/items'
import {
  ActionState,
  DroppedFood,
  Eating,
  Position,
  Rotation,
  Vitals,
} from '../traits'
import { eatingSystem } from './eatingSystem'

const BERRY = listItems().find((item) => item.category === 'berry')
const DELTA = 1 / 60

const worlds = []
afterEach(() => {
  while (worlds.length) worlds.pop().destroy()
})

function setup({ hp = 1, maxHp = 1000 } = {}) {
  const world = createWorld()
  worlds.push(world)
  const eater = world.spawn(
    Position,
    Rotation,
    ActionState,
    Vitals({ hp, maxHp }),
  )
  comecarAComer(eater, BERRY)
  return { world, eater, tick: () => eatingSystem({ world, delta: DELTA }) }
}

function ticksFor(seconds) {
  return Math.ceil(seconds / DELTA)
}

describe('eatingSystem', () => {
  it('cura aos poucos, na fração do tempo comido', () => {
    const { eater, tick } = setup()
    const startHp = eater.get(Vitals).hp
    const half = ticksFor(BERRY.berry.duration / 2)

    for (let i = 0; i < half; i++) tick()

    const expected =
      (BERRY.berry.healAmount * half * DELTA) / BERRY.berry.duration
    expect(eater.get(Vitals).hp - startHp).toBeCloseTo(expected)
    expect(eater.get(ActionState).current).toBe('eat')
  })

  it('no fim da duração curou o total e terminou', () => {
    const { eater, tick } = setup()
    const startHp = eater.get(Vitals).hp

    for (let i = 0; i < ticksFor(BERRY.berry.duration) + 5; i++) tick()

    expect(eater.get(Vitals).hp - startHp).toBeCloseTo(BERRY.berry.healAmount)
    expect(eater.get(ActionState).current).toBe(null)
    expect(eater.has(Eating)).toBe(false)
  })

  it('não passa da vida máxima', () => {
    const maxHp = 10
    const { eater, tick } = setup({ hp: maxHp - 0.5, maxHp })

    for (let i = 0; i < ticksFor(BERRY.berry.duration) + 5; i++) tick()

    expect(eater.get(Vitals).hp).toBe(maxHp)
  })

  it('a ação trocada por fora (ex.: desmaio) derruba a comida e para a cura', () => {
    const { world, eater, tick } = setup()
    tick()
    eater.set(ActionState, { current: null })
    const hp = eater.get(Vitals).hp

    tick()
    tick()

    expect(eater.has(Eating)).toBe(false)
    expect(world.query(DroppedFood).length).toBe(1)
    expect(eater.get(Vitals).hp).toBe(hp)
  })
})
