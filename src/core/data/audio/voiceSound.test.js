import { describe, it, expect } from 'vitest'
import {
  resolveVoiceSound,
  DEFAULT_VOICE_MIN_INTERVAL,
  DEFAULT_VOICE_MAX_INTERVAL,
} from './voiceSound'

describe('resolveVoiceSound', () => {
  it('espécie sem `sounds` não tem voz', () => {
    expect(resolveVoiceSound({})).toBe(null)
  })

  it('espécie com `sounds` mas sem `voice` não tem voz', () => {
    expect(resolveVoiceSound({ sounds: {} })).toBe(null)
  })

  it('`sounds.voice` declarado é devolvido como está (sem grupo, diferente do passo)', () => {
    const voice = { clips: ['a.wav'], minInterval: 5, maxInterval: 10 }
    expect(resolveVoiceSound({ sounds: { voice } })).toBe(voice)
  })

  it('charmander (espécie real do projeto) tem voz configurada', async () => {
    const { CHARMANDER } = await import('../species/004-charmander')
    const voice = resolveVoiceSound(CHARMANDER)
    expect(voice).not.toBe(null)
    expect(voice.clips.length).toBeGreaterThan(0)
  })
})

describe('defaults de intervalo', () => {
  it('mínimo é menor que o máximo', () => {
    expect(DEFAULT_VOICE_MIN_INTERVAL).toBeLessThan(DEFAULT_VOICE_MAX_INTERVAL)
  })
})
