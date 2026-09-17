import { describe, it, expect } from 'vitest'
import {
  registerVoiceAudio,
  unregisterVoiceAudio,
  getVoiceAudioEntry,
} from './voiceAudioRegistry'

function fakeAudio() {
  return {
    isPlaying: false,
    stop: () => {},
    disconnect: () => {},
  }
}

describe('registerVoiceAudio — immediate (criatura invocada vocaliza na hora)', () => {
  it('`immediate: true` começa o timer em 0 (toca assim que houver buffer)', () => {
    const entity = {}
    registerVoiceAudio(entity, fakeAudio(), {
      minInterval: 10,
      maxInterval: 25,
      immediate: true,
    })

    expect(getVoiceAudioEntry(entity).timer).toBe(0)

    unregisterVoiceAudio(entity)
  })

  it('sem `immediate` (default), o timer sai sorteado dentro de min/max — nunca 0 (a menos que minInterval seja 0)', () => {
    const entity = {}
    registerVoiceAudio(entity, fakeAudio(), {
      minInterval: 10,
      maxInterval: 25,
    })

    const { timer } = getVoiceAudioEntry(entity)
    expect(timer).toBeGreaterThanOrEqual(10)
    expect(timer).toBeLessThanOrEqual(25)

    unregisterVoiceAudio(entity)
  })

  it('`immediate: false` explícito tem o mesmo efeito que omitir', () => {
    const entity = {}
    registerVoiceAudio(entity, fakeAudio(), {
      minInterval: 10,
      maxInterval: 25,
      immediate: false,
    })

    expect(getVoiceAudioEntry(entity).timer).toBeGreaterThanOrEqual(10)

    unregisterVoiceAudio(entity)
  })
})
