import { describe, expect, it } from 'vitest'
import { stepWeatherLevels } from './weatherLevels'
import { WEATHER_TYPES } from './weatherMap'

// Troca gradual de clima (docs/features/048-dia-noite-e-clima.md).
const CLEAR = { clear: 1, rain: 0, storm: 0, snow: 0 }
const TRANSITION = 4

describe('stepWeatherLevels', () => {
  it('cada força anda no máximo delta / transition por passo', () => {
    const delta = 0.5
    const next = stepWeatherLevels(CLEAR, 'rain', 1, delta, TRANSITION)
    expect(next.rain).toBeCloseTo(delta / TRANSITION)
    expect(next.clear).toBeCloseTo(1 - delta / TRANSITION)
    expect(next.storm).toBe(0)
  })

  it('chega ao alvo e para nele (sem passar)', () => {
    let levels = CLEAR
    for (let i = 0; i < 100; i++) {
      levels = stepWeatherLevels(levels, 'snow', 0.6, 0.5, TRANSITION)
    }
    expect(levels.snow).toBeCloseTo(0.6)
    for (const type of WEATHER_TYPES.filter((t) => t !== 'snow')) {
      expect(levels[type]).toBeCloseTo(0)
    }
    expect(levels.type).toBe('snow')
  })

  it('o limpo vai até a força cheia', () => {
    let levels = { clear: 0, rain: 1, storm: 0, snow: 0 }
    for (let i = 0; i < 100; i++) {
      levels = stepWeatherLevels(levels, 'clear', 0, 0.5, TRANSITION)
    }
    expect(levels.clear).toBeCloseTo(1)
    expect(levels.rain).toBeCloseTo(0)
  })

  it('type é o de maior força agora (no meio da troca, ainda o antigo)', () => {
    const next = stepWeatherLevels(CLEAR, 'storm', 1, 0.1, TRANSITION)
    expect(next.type).toBe('clear')
  })
})
