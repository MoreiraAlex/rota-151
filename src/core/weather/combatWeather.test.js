import { afterEach, describe, expect, it } from 'vitest'
import { createWorld } from 'koota'
import { makeWorld } from '@/test/makeWorld'
import { forcarClima } from '../actions'
import { WorldClock } from '../traits'
import { combatWeatherAt } from './combatWeather'
import { weatherAt } from './worldWeather'

// Qual clima vale no lugar de um golpe (docs/features/048-dia-noite-e-
// clima.md).
const worlds = []
afterEach(() => {
  while (worlds.length) worlds.pop().destroy()
})

function setup(weather) {
  const { world } = makeWorld({ weather })
  worlds.push(world)
  return world
}

describe('combatWeatherAt', () => {
  it('segue o mapa de clima no lugar e na hora', () => {
    const world = setup(null)
    const time = world.get(WorldClock).time
    for (const place of [
      { x: 0, z: 0 },
      { x: -500, z: 300 },
      { x: 1200, z: -900 },
    ]) {
      expect(combatWeatherAt(world, place)).toBe(
        weatherAt(place.x, place.z, time).type,
      )
    }
  })

  it('o clima forçado pelo debug vale em todo lugar', () => {
    const world = setup(null)
    forcarClima(world, 'rain')
    expect(combatWeatherAt(world, { x: 0, z: 0 })).toBe('rain')
    expect(combatWeatherAt(world, { x: 9000, z: -9000 })).toBe('rain')
  })

  it('mundo sem relógio: limpo', () => {
    const world = createWorld()
    worlds.push(world)
    expect(combatWeatherAt(world, { x: 0, z: 0 })).toBe('clear')
  })
})
