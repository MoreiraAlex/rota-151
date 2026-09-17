import { describe, it, expect } from 'vitest'
import {
  resolveAmbientSound,
  DEFAULT_AMBIENT_MIN_INTERVAL,
  DEFAULT_AMBIENT_MAX_INTERVAL,
} from './ambientSound'

describe('resolveAmbientSound', () => {
  it('nível sem `ambientSound` fica em silêncio', () => {
    expect(resolveAmbientSound({})).toBe(null)
  })

  it('nível `null`/undefined não quebra', () => {
    expect(resolveAmbientSound(null)).toBe(null)
    expect(resolveAmbientSound(undefined)).toBe(null)
  })

  it('`ambientSound` declarado é devolvido como está', () => {
    const ambientSound = { clips: ['wind-01.wav'], minInterval: 15 }
    expect(resolveAmbientSound({ ambientSound })).toBe(ambientSound)
  })

  it('TEST_LEVEL (nível real do projeto) tem som ambiente configurado', async () => {
    const { TEST_LEVEL } = await import('../testLevel')
    const ambient = resolveAmbientSound(TEST_LEVEL)
    expect(ambient).not.toBe(null)
    expect(ambient.clips.length).toBeGreaterThan(0)
  })
})

describe('defaults de intervalo', () => {
  it('mínimo é menor que o máximo', () => {
    expect(DEFAULT_AMBIENT_MIN_INTERVAL).toBeLessThan(
      DEFAULT_AMBIENT_MAX_INTERVAL,
    )
  })
})
