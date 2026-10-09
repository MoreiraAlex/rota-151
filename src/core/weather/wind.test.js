import { describe, expect, it } from 'vitest'
import { GAME_CONFIG } from '../gameConfig'
import { WEATHER_TYPES } from './weatherMap'
import { windStrengthOf } from './wind'

const only = (type) =>
  Object.fromEntries(WEATHER_TYPES.map((kind) => [kind, kind === type ? 1 : 0]))

describe('windStrengthOf', () => {
  it.each(WEATHER_TYPES)('só %s: a força desse clima', (type) => {
    expect(windStrengthOf(only(type))).toBeCloseTo(
      GAME_CONFIG.WIND.STRENGTH[type],
    )
  })

  it('a tempestade venta mais que o tempo limpo', () => {
    expect(windStrengthOf(only('storm'))).toBeGreaterThan(
      windStrengthOf(only('clear')),
    )
  })

  it('na troca de clima o vento muda aos poucos, sem salto', () => {
    let previous = windStrengthOf(only('clear'))
    const steps = 50
    const largest =
      Math.abs(
        GAME_CONFIG.WIND.STRENGTH.storm - GAME_CONFIG.WIND.STRENGTH.clear,
      ) / steps
    for (let step = 1; step <= steps; step++) {
      const t = step / steps
      const strength = windStrengthOf({ clear: 1 - t, storm: t })
      expect(Math.abs(strength - previous)).toBeLessThanOrEqual(largest + 1e-9)
      previous = strength
    }
  })

  it('sem força nenhuma: a do tempo limpo', () => {
    expect(windStrengthOf({})).toBe(GAME_CONFIG.WIND.STRENGTH.clear)
  })
})
