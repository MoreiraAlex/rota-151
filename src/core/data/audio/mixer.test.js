import { describe, expect, it } from 'vitest'
import { DEFAULT_VOLUMES, SOUND_CHANNELS, VOLUME_KEYS } from './mixer'

// Canais de volume (docs/features/065-sons-do-mundo.md, Parte 1).
describe('canais de volume', () => {
  it('o geral e todo canal têm volume padrão entre 0 e 1', () => {
    expect(VOLUME_KEYS).toContain('master')
    for (const channel of SOUND_CHANNELS) expect(VOLUME_KEYS).toContain(channel)
    for (const key of VOLUME_KEYS) {
      expect(DEFAULT_VOLUMES[key]).toBeGreaterThanOrEqual(0)
      expect(DEFAULT_VOLUMES[key]).toBeLessThanOrEqual(1)
    }
  })
})
