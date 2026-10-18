import { describe, it, expect } from 'vitest'
import { GAME_CONFIG } from '@/core/gameConfig'
import {
  resolveFireLight,
  resolveFireLightIntensity,
  resolveFireLightFade,
  resolveFaintedScale,
} from './fireLightSystem'

const DEFAULTS = GAME_CONFIG.FIRE_LIGHT

describe('resolveFireLight', () => {
  it('sem campos, usa os padrões do GAME_CONFIG', () => {
    const resolved = resolveFireLight({ bone: 'tip' })
    expect(resolved).toEqual({
      bone: 'tip',
      color: DEFAULTS.COLOR,
      intensity: DEFAULTS.INTENSITY,
      distance: DEFAULTS.DISTANCE,
      decay: DEFAULTS.DECAY,
      faintedIntensity: DEFAULTS.FAINTED_INTENSITY,
      position: { x: 0, y: 0, z: 0 },
      flicker: {
        speed: DEFAULTS.FLICKER_SPEED,
        amount: DEFAULTS.FLICKER_AMOUNT,
        noise: DEFAULTS.FLICKER_NOISE,
      },
    })
  })

  it('o que a espécie declara vence o padrão, campo a campo', () => {
    const resolved = resolveFireLight({
      bone: 'tip',
      intensity: DEFAULTS.INTENSITY * 2,
      position: { y: 1 },
      flicker: { amount: 0 },
    })
    expect(resolved.intensity).toBe(DEFAULTS.INTENSITY * 2)
    expect(resolved.position).toEqual({ x: 0, y: 1, z: 0 })
    expect(resolved.flicker.amount).toBe(0)
    expect(resolved.flicker.speed).toBe(DEFAULTS.FLICKER_SPEED)
  })
})

describe('resolveFireLightIntensity', () => {
  const flicker = { speed: 10, amount: 0.2, noise: 0.1 }

  it('sem tremor, fica no brilho base', () => {
    const still = { speed: 10, amount: 0, noise: 0 }
    expect(resolveFireLightIntensity(3, 1.234, still, 0.9)).toBe(3)
  })

  it('o tremor fica dentro da amplitude do seno mais a do ruído', () => {
    const max = 1 + flicker.amount + flicker.noise / 2
    const min = 1 - flicker.amount - flicker.noise / 2
    for (let t = 0; t < 2; t += 0.05) {
      for (const random of [0, 0.5, 1]) {
        const value = resolveFireLightIntensity(1, t, flicker, random)
        expect(value).toBeLessThanOrEqual(max + 1e-9)
        expect(value).toBeGreaterThanOrEqual(min - 1e-9)
      }
    }
  })

  it('nunca fica negativo', () => {
    const wild = { speed: 10, amount: 2, noise: 2 }
    for (let t = 0; t < 2; t += 0.05) {
      expect(resolveFireLightIntensity(1, t, wild, 0)).toBeGreaterThanOrEqual(0)
    }
  })
})

describe('resolveFireLightFade', () => {
  const duration = DEFAULTS.FAINT_FADE_DURATION

  it('desmaiada, apaga até 0 em FAINT_FADE_DURATION', () => {
    const half = resolveFireLightFade(1, true, duration / 2)
    expect(half).toBeCloseTo(0.5)
    expect(resolveFireLightFade(half, true, duration)).toBe(0)
  })

  it('acordada, reacende até 1 sem passar', () => {
    expect(resolveFireLightFade(0, false, duration / 2)).toBeCloseTo(0.5)
    expect(resolveFireLightFade(0.9, false, duration)).toBe(1)
  })

  it('já no alvo, não muda', () => {
    expect(resolveFireLightFade(1, false, 0.1)).toBe(1)
    expect(resolveFireLightFade(0, true, 0.1)).toBe(0)
  })
})

describe('resolveFaintedScale', () => {
  const faintedIntensity = DEFAULTS.FAINTED_INTENSITY

  it('desmaiada por inteiro, sobra faintedIntensity do brilho (fraca, não 0)', () => {
    expect(faintedIntensity).toBeGreaterThan(0)
    expect(resolveFaintedScale(0, faintedIntensity)).toBe(faintedIntensity)
  })

  it('acordada, brilho inteiro', () => {
    expect(resolveFaintedScale(1, faintedIntensity)).toBe(1)
  })

  it('no meio do caminho, fica entre os dois', () => {
    const half = resolveFaintedScale(0.5, faintedIntensity)
    expect(half).toBeGreaterThan(faintedIntensity)
    expect(half).toBeLessThan(1)
  })
})
