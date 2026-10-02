import { afterEach, describe, expect, it } from 'vitest'
import { createWorld } from 'koota'
import { DashCooldown } from '../traits'
import { dashCooldownSystem } from './dashCooldownSystem'

const worlds = []
afterEach(() => {
  while (worlds.length) worlds.pop().destroy()
})

describe('dashCooldownSystem', () => {
  it('conta a recarga do dash até zero, sem passar', () => {
    const world = createWorld()
    worlds.push(world)
    const entity = world.spawn(DashCooldown({ timeLeft: 0.5 }))

    dashCooldownSystem({ world, delta: 0.2 })
    expect(entity.get(DashCooldown).timeLeft).toBeCloseTo(0.3)

    dashCooldownSystem({ world, delta: 1 })
    expect(entity.get(DashCooldown).timeLeft).toBe(0)
  })
})
