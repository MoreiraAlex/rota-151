import { describe, expect, it } from 'vitest'
import { GAME_CONFIG } from '../gameConfig'
import {
  WEATHER_TYPES,
  createWeatherSampler,
  pickWeatherType,
  weatherPeriodOf,
  weatherRegionAt,
} from './weatherMap'

// Clima por região e período (docs/features/048-dia-noite-e-clima.md). Os
// biomas aqui são de teste: só as chances importam.
const PARAMS = GAME_CONFIG.WEATHER
const { REGION_SIZE, PERIOD } = PARAMS
const SEED = 151

const biome = (weather) => ({ id: 'teste', weather })
const MIXED = biome({ clear: 4, sun: 2, rain: 3, storm: 2, snow: 1 })
const sameBiome = (b) => () => b

// Centro da região (rx, rz) e um horário no meio do período.
const regionCenter = (rx, rz) => [
  (rx + 0.5) * REGION_SIZE,
  (rz + 0.5) * REGION_SIZE,
]
const periodTime = (period) => (period + 0.5) * PERIOD
// Meio-dia do dia `day` (o sol forte só vale de dia).
const noon = (day) => day + 0.5

describe('pickWeatherType', () => {
  it('percorre os pesos em ordem e ignora peso zero', () => {
    const weights = { clear: 1, rain: 0, storm: 1, snow: 0 }
    expect(pickWeatherType(weights, 0)).toBe('clear')
    expect(pickWeatherType(weights, 0.49)).toBe('clear')
    expect(pickWeatherType(weights, 0.5)).toBe('storm')
    expect(pickWeatherType(weights, 0.9999)).toBe('storm')
  })

  it('nunca devolve um tipo de peso zero', () => {
    const weights = { clear: 0, rain: 2, storm: 0, snow: 1 }
    for (let roll = 0; roll < 1; roll += 0.01) {
      expect(['rain', 'snow']).toContain(pickWeatherType(weights, roll))
    }
  })
})

describe('regiões e períodos', () => {
  it('pontos da mesma região caem nela; a borda abre outra', () => {
    expect(weatherRegionAt(1, 1, REGION_SIZE)).toEqual({ rx: 0, rz: 0 })
    expect(weatherRegionAt(REGION_SIZE - 1, 0, REGION_SIZE)).toEqual({
      rx: 0,
      rz: 0,
    })
    expect(weatherRegionAt(REGION_SIZE, -1, REGION_SIZE)).toEqual({
      rx: 1,
      rz: -1,
    })
  })

  it('o período muda a cada PERIOD', () => {
    expect(weatherPeriodOf(0, PERIOD)).toBe(0)
    expect(weatherPeriodOf(PERIOD * 0.99, PERIOD)).toBe(0)
    expect(weatherPeriodOf(PERIOD * 3, PERIOD)).toBe(3)
  })
})

describe('createWeatherSampler', () => {
  it('determinístico: mesma seed, lugar e horário → mesmo clima', () => {
    const a = createWeatherSampler(SEED, sameBiome(MIXED))
    const b = createWeatherSampler(SEED, sameBiome(MIXED))
    for (let i = 0; i < 50; i++) {
      const [x, z] = regionCenter(i, -i)
      expect(b.weatherAt(x, z, periodTime(i))).toEqual(
        a.weatherAt(x, z, periodTime(i)),
      )
    }
  })

  it('outra seed muda o clima em algum lugar', () => {
    const a = createWeatherSampler(SEED, sameBiome(MIXED))
    const b = createWeatherSampler(SEED + 1, sameBiome(MIXED))
    const differs = Array.from({ length: 50 }, (_, i) => {
      const [x, z] = regionCenter(i, 0)
      const time = periodTime(i)
      return a.weatherAt(x, z, time).type !== b.weatherAt(x, z, time).type
    })
    expect(differs).toContain(true)
  })

  it('dentro de uma região e de um período, o clima é o mesmo', () => {
    const sampler = createWeatherSampler(SEED, sameBiome(MIXED))
    const time = periodTime(7)
    const reference = sampler.weatherAt(1, 1, time)
    for (const [x, z] of [
      [REGION_SIZE - 1, 1],
      [1, REGION_SIZE - 1],
      [REGION_SIZE / 2, REGION_SIZE / 3],
    ]) {
      expect(sampler.weatherAt(x, z, time)).toEqual(reference)
      expect(sampler.weatherAt(x, z, 7 * PERIOD)).toEqual(reference)
    }
  })

  it('usa o bioma do centro da região', () => {
    const asked = []
    const sampler = createWeatherSampler(SEED, (x, z) => {
      asked.push([x, z])
      return MIXED
    })
    sampler.weatherAt(3, 5, 0)
    expect(asked).toEqual([regionCenter(0, 0)])
  })

  it('um tipo com peso zero no bioma nunca sai', () => {
    const noSnow = biome({ clear: 1, sun: 1, rain: 1, storm: 1, snow: 0 })
    const sampler = createWeatherSampler(SEED, sameBiome(noSnow))
    for (let i = 0; i < 400; i++) {
      const [x, z] = regionCenter(i % 20, Math.floor(i / 20))
      expect(sampler.weatherAt(x, z, periodTime(i)).type).not.toBe('snow')
    }
  })

  it('numa amostra grande, a frequência segue os pesos (de dia)', () => {
    const sampler = createWeatherSampler(SEED, sameBiome(MIXED))
    const counts = Object.fromEntries(WEATHER_TYPES.map((type) => [type, 0]))
    const samples = 4000
    for (let i = 0; i < samples; i++) {
      const [x, z] = regionCenter(i % 40, Math.floor(i / 40))
      counts[sampler.weatherAt(x, z, noon(i % 7)).type] += 1
    }
    const total = WEATHER_TYPES.reduce((sum, t) => sum + MIXED.weather[t], 0)
    for (const type of WEATHER_TYPES) {
      expect(counts[type] / samples).toBeCloseTo(MIXED.weather[type] / total, 1)
    }
  })

  it('sol forte só de dia: à noite a mesma região fica limpa', () => {
    const allSun = biome({ clear: 0, sun: 1, rain: 0, storm: 0, snow: 0 })
    const sampler = createWeatherSampler(SEED, sameBiome(allSun))
    expect(sampler.weatherAt(1, 1, noon(3)).type).toBe('sun')
    expect(sampler.weatherAt(1, 1, 3)).toEqual({ type: 'clear', intensity: 0 })
  })

  it('força: zero no limpo; entre MIN_INTENSITY e 1 nos outros', () => {
    const sampler = createWeatherSampler(SEED, sameBiome(MIXED))
    for (let i = 0; i < 300; i++) {
      const [x, z] = regionCenter(i, i)
      const { type, intensity } = sampler.weatherAt(x, z, periodTime(i))
      if (type === 'clear') expect(intensity).toBe(0)
      else {
        expect(intensity).toBeGreaterThanOrEqual(PARAMS.MIN_INTENSITY)
        expect(intensity).toBeLessThanOrEqual(1)
      }
    }
  })
})
