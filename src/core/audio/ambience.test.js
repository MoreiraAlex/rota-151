import { describe, expect, it } from 'vitest'
import {
  AMBIENT_FALLBACK_BIOME,
  BIOME_AMBIENCE,
} from '../data/audio/ambientBeds'
import { ambientBedLevels, daylightFactor, oneShotPresence } from './ambience'

// Regras do som ambiente (docs/features/065-sons-do-mundo.md, Parte 4).
// Biomas, fundos e números só como dado de teste.
const TABLE = {
  forest: { day: 'f-day', night: 'n' },
  plains: { day: 'p-day', night: 'n' },
}
const TWILIGHT = { min: -0.1, max: 0.1 }
const sum = (levels) => Object.values(levels).reduce((a, b) => a + b, 0)

describe('daylightFactor', () => {
  it('noite abaixo da faixa, dia acima, mistura no meio', () => {
    expect(daylightFactor(-1, TWILIGHT)).toBe(0)
    expect(daylightFactor(1, TWILIGHT)).toBe(1)
    const middle = daylightFactor(0, TWILIGHT)
    expect(middle).toBeGreaterThan(0)
    expect(middle).toBeLessThan(1)
  })
})

describe('ambientBedLevels', () => {
  it('de dia, cada bioma soa no fundo de dia com o seu peso', () => {
    const levels = ambientBedLevels(
      { forest: 0.7, plains: 0.3 },
      { daylight: 1 },
      TABLE,
    )
    expect(levels['f-day']).toBeCloseTo(0.7)
    expect(levels['p-day']).toBeCloseTo(0.3)
    expect(levels.n).toBeUndefined()
  })

  it('a soma dos fundos é o peso total, em qualquer hora', () => {
    for (const daylight of [0, 0.3, 1]) {
      const levels = ambientBedLevels(
        { forest: 0.6, plains: 0.4 },
        { daylight },
        TABLE,
      )
      expect(sum(levels)).toBeCloseTo(1)
    }
  })

  it('bioma sem peso fica sem som', () => {
    const levels = ambientBedLevels(
      { forest: 1, plains: 0 },
      { daylight: 1 },
      TABLE,
    )
    expect(levels['p-day']).toBeUndefined()
  })

  it('a chuva baixa só o fundo de dia', () => {
    const dry = ambientBedLevels({ forest: 1 }, { daylight: 0.5 }, TABLE)
    const wet = ambientBedLevels(
      { forest: 1 },
      { daylight: 0.5, rain: 1, rainDucking: 0.5 },
      TABLE,
    )
    expect(wet['f-day']).toBeCloseTo(dry['f-day'] * 0.5)
    expect(wet.n).toBeCloseTo(dry.n)
  })

  it('bioma sem entrada usa o de reserva', () => {
    const levels = ambientBedLevels({ vulcao: 1 }, { daylight: 1 })
    expect(Object.keys(levels)).toEqual([
      BIOME_AMBIENCE[AMBIENT_FALLBACK_BIOME].day,
    ])
  })
})

describe('oneShotPresence', () => {
  const OWL = { biomes: ['forest'], time: 'night' }

  it('só na hora e no lugar dele', () => {
    expect(oneShotPresence(OWL, { forest: 1 }, 0)).toBe(1)
    expect(oneShotPresence(OWL, { forest: 1 }, 1)).toBe(0)
    expect(oneShotPresence(OWL, { plains: 1 }, 0)).toBe(0)
  })

  it('na borda, pelo peso do bioma', () => {
    expect(oneShotPresence(OWL, { forest: 0.4, plains: 0.6 }, 0)).toBeCloseTo(
      0.4,
    )
  })
})
