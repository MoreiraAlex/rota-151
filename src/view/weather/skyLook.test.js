import { describe, expect, it } from 'vitest'
import { GAME_CONFIG } from '@/core/gameConfig'
import { lightingAt } from '@/core/time/dayCycle'
import { overcastOf, resolveSkyLook } from './skyLook'

// Céu fechado e clarão por cima da luz da hora (docs/features/048-dia-
// noite-e-clima.md).
const { OVERCAST } = GAME_CONFIG.WEATHER
const CLEAR = { clear: 1, rain: 0, storm: 0, snow: 0 }
const FULL = (type) => ({ clear: 0, rain: 0, storm: 0, snow: 0, [type]: 1 })
const NOON = lightingAt(0.5)
const MIDNIGHT = lightingAt(0)
const spread = (rgb) => Math.max(...rgb) - Math.min(...rgb)

describe('overcastOf', () => {
  it('limpo não fecha; cada tipo na força cheia fecha o dele', () => {
    expect(overcastOf(CLEAR)).toBe(OVERCAST.clear)
    for (const type of Object.keys(OVERCAST)) {
      expect(overcastOf(FULL(type))).toBeCloseTo(Math.min(OVERCAST[type], 1))
    }
  })

  it('segue a força: metade da chuva fecha metade', () => {
    const half = { clear: 0.5, rain: 0.5, storm: 0, snow: 0 }
    expect(overcastOf(half)).toBeCloseTo(
      0.5 * OVERCAST.rain + 0.5 * OVERCAST.clear,
    )
  })
})

describe('resolveSkyLook', () => {
  it('céu limpo e sem clarão: a luz da hora como está', () => {
    const look = resolveSkyLook(NOON, CLEAR)
    expect(look.skyTop).toEqual(NOON.skyTop)
    expect(look.lightIntensity).toBeCloseTo(NOON.lightIntensity)
    expect(look.ambientIntensity).toBeCloseTo(NOON.ambientIntensity)
    expect(look.celestial).toBe(1)
  })

  it('tempestade: céu mais cinza, luz mais fraca, sol escondido', () => {
    const look = resolveSkyLook(NOON, FULL('storm'))
    expect(spread(look.skyTop)).toBeLessThan(spread(NOON.skyTop))
    expect(look.lightIntensity).toBeLessThan(NOON.lightIntensity)
    expect(look.celestial).toBeLessThan(1)
  })

  it('céu fechado enfraquece a sombra do sol', () => {
    const look = resolveSkyLook(NOON, FULL('storm'))
    expect(look.shadowIntensity).toBeLessThan(NOON.shadowIntensity)
  })

  it('céu fechado apaga as estrelas à noite', () => {
    const look = resolveSkyLook(MIDNIGHT, FULL('rain'))
    expect(look.stars).toBeLessThan(MIDNIGHT.stars)
  })

  it('nuvens: mais cobertura com o céu fechado', () => {
    const { COVER, OVERCAST_COVER } = GAME_CONFIG.CLOUDS
    expect(resolveSkyLook(NOON, CLEAR).cloudCover).toBeCloseTo(COVER)
    const storm = resolveSkyLook(NOON, FULL('storm')).cloudCover
    expect(storm).toBeGreaterThan(COVER)
    expect(storm).toBeLessThanOrEqual(OVERCAST_COVER)
  })

  it('nuvens: claras de dia, escuras à noite; a base mais escura', () => {
    const brightness = (rgb) => rgb.reduce((sum, value) => sum + value, 0)
    const day = resolveSkyLook(NOON, CLEAR)
    const night = resolveSkyLook(MIDNIGHT, CLEAR)
    expect(brightness(day.cloudLit)).toBeGreaterThan(brightness(night.cloudLit))
    expect(brightness(day.cloudShade)).toBeLessThan(brightness(day.cloudLit))
  })

  it('sol forte de dia: luz do sol mais forte e menos nuvens', () => {
    const clear = resolveSkyLook(NOON, CLEAR)
    const sun = resolveSkyLook(NOON, FULL('sun'))
    expect(sun.lightIntensity).toBeGreaterThan(clear.lightIntensity)
    expect(sun.cloudCover).toBeLessThan(clear.cloudCover)
  })

  it('sol forte não muda nada com o sol abaixo do horizonte', () => {
    const clear = resolveSkyLook(MIDNIGHT, CLEAR)
    const sun = resolveSkyLook(MIDNIGHT, FULL('sun'))
    expect(sun.sunny).toBe(0)
    expect(sun.lightIntensity).toBeCloseTo(clear.lightIntensity)
    expect(sun.cloudCover).toBeCloseTo(clear.cloudCover)
  })

  it('o clarão acende a luz ambiente', () => {
    const calm = resolveSkyLook(MIDNIGHT, FULL('storm'), 0)
    const flash = resolveSkyLook(MIDNIGHT, FULL('storm'), 1)
    expect(flash.ambientIntensity).toBeGreaterThan(calm.ambientIntensity)
  })
})
