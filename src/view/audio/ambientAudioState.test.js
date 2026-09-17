import { describe, it, expect, afterEach } from 'vitest'
import {
  getAmbientAudioState,
  resetAmbientAudioState,
} from './ambientAudioState'

afterEach(() => {
  resetAmbientAudioState()
})

describe('ambientAudioState', () => {
  it('começa zerado/vazio', () => {
    const state = getAmbientAudioState()
    expect(state.audio).toBe(null)
    expect(state.buffers).toEqual([])
    expect(state.timer).toBe(0)
  })

  it('getAmbientAudioState sempre devolve o MESMO objeto (estado global, não por entidade)', () => {
    expect(getAmbientAudioState()).toBe(getAmbientAudioState())
  })

  it('mutar o estado obtido persiste pra próxima leitura', () => {
    const state = getAmbientAudioState()
    state.timer = 30
    state.buffers.push('fake-buffer')

    expect(getAmbientAudioState().timer).toBe(30)
    expect(getAmbientAudioState().buffers).toEqual(['fake-buffer'])
  })

  it('resetAmbientAudioState volta tudo ao zerado/vazio', () => {
    const state = getAmbientAudioState()
    state.audio = { fake: true }
    state.buffers.push('fake-buffer')
    state.minInterval = 10
    state.maxInterval = 20
    state.timer = 15

    resetAmbientAudioState()

    const reset = getAmbientAudioState()
    expect(reset.audio).toBe(null)
    expect(reset.buffers).toEqual([])
    expect(reset.minInterval).toBe(0)
    expect(reset.maxInterval).toBe(0)
    expect(reset.timer).toBe(0)
  })
})
