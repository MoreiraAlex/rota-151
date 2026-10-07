import { afterEach, describe, expect, it } from 'vitest'
import { createWorld } from 'koota'
import { comecarAComer, isEating } from '../actions/eating'
import { listItems } from '../data/items'
import {
  attackResolved,
  burnDamaged,
  createEventQueue,
  leechSeedDrained,
} from '../events'
import {
  ActionState,
  DroppedFood,
  Eating,
  Position,
  Rotation,
  Vitals,
} from '../traits'
import { eatingInterruptSystem } from './eatingInterruptSystem'

const BERRY = listItems().find((item) => item.category === 'berry')

const worlds = []
afterEach(() => {
  while (worlds.length) worlds.pop().destroy()
})

function setup() {
  const world = createWorld()
  worlds.push(world)
  const eater = world.spawn(
    Position,
    Rotation,
    ActionState,
    Vitals({ hp: 10, maxHp: 100 }),
  )
  comecarAComer(eater, BERRY)
  const events = createEventQueue()
  return {
    world,
    eater,
    events,
    tick: () => eatingInterruptSystem({ world, events }),
  }
}

function hit(target, damage) {
  return attackResolved({
    attacker: null,
    target,
    attackId: 'tackle',
    slot: 'primary',
    origin: { x: 0, y: 0, z: 0 },
    impactPoint: { x: 0, y: 0, z: 1 },
    contactPoint: { x: 0, y: 0, z: 0.8 },
    damage,
  })
}

describe('eatingInterruptSystem', () => {
  it.each([
    ['golpe com dano', (target) => hit(target, 5)],
    [
      'queimadura',
      (target) => burnDamaged({ target, source: null, damage: 2 }),
    ],
    [
      'Leech Seed',
      (target) =>
        leechSeedDrained({ target, source: null, damage: 2, healed: 2 }),
    ],
  ])('tomar dano (%s) derruba a comida', (_, makeEvent) => {
    const { world, eater, events, tick } = setup()
    events.emit(makeEvent(eater))

    tick()

    expect(isEating(eater)).toBe(false)
    expect(eater.has(Eating)).toBe(false)
    expect(world.query(DroppedFood).length).toBe(1)
  })

  it('golpe sem dano (status) não interrompe', () => {
    const { world, eater, events, tick } = setup()
    events.emit(hit(eater, 0))

    tick()

    expect(isEating(eater)).toBe(true)
    expect(world.query(DroppedFood).length).toBe(0)
  })

  it('dano em outra entidade não interrompe quem come', () => {
    const { world, eater, events, tick } = setup()
    const other = world.spawn(Position, Vitals)
    events.emit(hit(other, 5))

    tick()

    expect(isEating(eater)).toBe(true)
  })
})
