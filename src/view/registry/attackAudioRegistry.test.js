import { describe, expect, it } from 'vitest'
import {
  getAttackAudioEntries,
  getAttackAudioEntry,
  registerAttackAudio,
  unregisterAttackAudio,
} from './attackAudioRegistry'

function fakeAudio() {
  return {
    isPlaying: false,
    stopped: 0,
    disconnected: 0,
    stop() {
      this.stopped += 1
      this.isPlaying = false
    },
    disconnect() {
      this.disconnected += 1
    },
  }
}

describe('attackAudioRegistry', () => {
  it('guarda as vozes por slot e uma lista de sons pendentes vazia', () => {
    const entity = {}
    const voices = {
      primary: [{ audio: fakeAudio(), delay: 0, buffers: [] }],
      secondary2: [
        { audio: fakeAudio(), delay: 0, buffers: [] },
        { audio: fakeAudio(), delay: 0.5, buffers: [] },
      ],
    }
    registerAttackAudio(entity, voices)

    const entry = getAttackAudioEntry(entity)
    expect(entry.voices).toBe(voices)
    expect(entry.pending).toEqual([])
    expect([...getAttackAudioEntries()].some(([e]) => e === entity)).toBe(true)

    unregisterAttackAudio(entity)
  })

  it('unregister para o que estiver tocando, desconecta TODAS as vozes e remove a entrada', () => {
    const entity = {}
    const playing = fakeAudio()
    playing.isPlaying = true
    const idle = fakeAudio()
    registerAttackAudio(entity, {
      primary: [{ audio: playing, delay: 0, buffers: [] }],
      secondary2: [{ audio: idle, delay: 0.5, buffers: [] }],
    })

    unregisterAttackAudio(entity)

    expect(playing.stopped).toBe(1)
    expect(idle.stopped).toBe(0)
    expect(playing.disconnected).toBe(1)
    expect(idle.disconnected).toBe(1)
    expect(getAttackAudioEntry(entity)).toBeUndefined()
  })

  it('unregister de entidade desconhecida não quebra', () => {
    expect(() => unregisterAttackAudio({})).not.toThrow()
  })
})
