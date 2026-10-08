import { afterEach, describe, expect, it } from 'vitest'
import { makeWorld } from '@/test/makeWorld'
import { EVENT_TYPES, createEventQueue } from '../events'
import { GAME_CONFIG } from '../gameConfig'
import { LocalWeather, Position, WorldClock } from '../traits'
import { forcarClima } from '../actions'
import { weatherAt } from '../weather/worldWeather'
import { weatherSystem } from './weatherSystem'

// Clima onde está o jogador (docs/features/048-dia-noite-e-clima.md).
const { TRANSITION, LIGHTNING_INTERVAL } = GAME_CONFIG.WEATHER
const STEP = GAME_CONFIG.LOOP.FIXED_TIMESTEP

const worlds = []
afterEach(() => {
  while (worlds.length) worlds.pop().destroy()
})

function setup() {
  const { world, player } = makeWorld({ weather: null })
  worlds.push(world)
  const events = createEventQueue()
  const run = (seconds) => {
    for (let t = 0; t < seconds; t += STEP) {
      events.beginStep()
      weatherSystem({ world, delta: STEP, events })
    }
  }
  return { world, player, events, run }
}

describe('weatherSystem', () => {
  it('segue o mapa de clima no lugar e na hora do controlado', () => {
    const { world, player, run } = setup()
    const { x, z } = player.get(Position)
    const expected = weatherAt(x, z, world.get(WorldClock).time)
    run(TRANSITION + 1)
    const weather = world.get(LocalWeather)
    expect(weather.target).toBe(expected.type)
    expect(weather.type).toBe(expected.type)
  })

  it('forçado pelo debug: chega ao tipo aos poucos, na força cheia', () => {
    const { world, run } = setup()
    forcarClima(world, 'snow')
    run(TRANSITION / 2)
    const half = world.get(LocalWeather)
    expect(half.snow).toBeGreaterThan(0)
    expect(half.snow).toBeLessThan(1)
    run(TRANSITION)
    const full = world.get(LocalWeather)
    expect(full.snow).toBeCloseTo(1)
    expect(full.type).toBe('snow')
  })

  it('forcarClima ignora tipo que não existe; null volta ao mapa', () => {
    const { world } = setup()
    forcarClima(world, 'granizo')
    expect(world.get(LocalWeather).forced).toBeNull()
    forcarClima(world, 'rain')
    forcarClima(world, null)
    expect(world.get(LocalWeather).forced).toBeNull()
  })

  it('tempestade solta relâmpagos; sem tempestade, nenhum', () => {
    const { world, events, run } = setup()
    const strikes = []
    const collect = (seconds) => {
      for (let t = 0; t < seconds; t += STEP) {
        events.beginStep()
        weatherSystem({ world, delta: STEP, events })
        strikes.push(
          ...events
            .stepEvents()
            .filter((event) => event.type === EVENT_TYPES.LIGHTNING_STRUCK),
        )
      }
    }

    forcarClima(world, 'snow')
    collect(LIGHTNING_INTERVAL[1] * 3)
    expect(strikes).toHaveLength(0)

    forcarClima(world, 'storm')
    run(TRANSITION)
    collect(LIGHTNING_INTERVAL[1] * 3)
    expect(strikes.length).toBeGreaterThan(0)
    for (const strike of strikes) {
      expect(strike.thunderDelay).toBeGreaterThanOrEqual(0)
      expect(strike.strength).toBeGreaterThan(0)
    }
  })
})
