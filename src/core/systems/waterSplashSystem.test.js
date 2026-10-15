import { afterEach, describe, expect, it } from 'vitest'
import { createWorld } from 'koota'
import { Position, WaterSplash } from '../traits'
import { waterSplashSystem } from './waterSplashSystem'

const worlds = []
afterEach(() => {
  while (worlds.length) worlds.pop().destroy()
})

describe('waterSplashSystem', () => {
  it('conta o tempo e some ao chegar na duração', () => {
    const world = createWorld()
    worlds.push(world)
    const splash = world.spawn(Position, WaterSplash({ duration: 0.5 }))

    waterSplashSystem({ world, delta: 0.3 })
    expect(splash.get(WaterSplash).elapsed).toBeCloseTo(0.3)

    waterSplashSystem({ world, delta: 0.3 })
    expect(splash.isAlive()).toBe(false)
  })
})
