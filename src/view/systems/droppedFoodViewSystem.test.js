import { afterEach, describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { createWorld } from 'koota'
import { DroppedFood, Position, Rotation, Velocity } from '@/core/traits'
import {
  registerDroppedFood,
  unregisterDroppedFood,
} from '../registry/droppedFoodRegistry'
import { drainFoodVfx } from '../vfx/foodVfxQueue'
import { droppedFoodViewSystem } from './droppedFoodViewSystem'

const cleanup = []
afterEach(() => {
  while (cleanup.length) cleanup.pop()()
  drainFoodVfx()
})

function setup({ velocity = { x: 1, y: 0, z: 0 }, resting = false } = {}) {
  const world = createWorld()
  const food = world.spawn(
    Position,
    Rotation,
    Velocity(velocity),
    DroppedFood({ itemId: 'x', lifetime: 10, resting }),
  )
  const tumble = new THREE.Group()
  registerDroppedFood(food, { current: tumble }, 0)
  cleanup.push(() => {
    unregisterDroppedFood(food)
    world.destroy()
  })
  return {
    world,
    food,
    tumble,
    tick: () => droppedFoodViewSystem({ world, delta: 1 / 60 }),
  }
}

describe('droppedFoodViewSystem', () => {
  it('andando, a fruta gira (rola); parada, não', () => {
    const moving = setup()
    const resting = setup({ velocity: { x: 0, y: 0, z: 0 }, resting: true })

    moving.tick()
    resting.tick()

    expect(moving.tumble.quaternion.equals(new THREE.Quaternion())).toBe(false)
    expect(resting.tumble.quaternion.equals(new THREE.Quaternion())).toBe(true)
  })

  it('cada quique novo pede um respingo, uma vez só', () => {
    const { food, tick } = setup()
    tick()
    expect(drainFoodVfx()).toHaveLength(0)

    food.set(DroppedFood, { ...food.get(DroppedFood), landings: 1 })
    tick()
    tick()

    const requests = drainFoodVfx()
    expect(requests).toHaveLength(1)
    expect(requests[0].kind).toBe('land')
  })
})
