import { describe, it, expect } from 'vitest'
import { createSimpleAudioRegistry } from './createSimpleAudioRegistry'

function fakeAudio() {
  return {
    isPlaying: false,
    stop: () => {},
    disconnect: () => {},
  }
}

describe('createSimpleAudioRegistry', () => {
  it('register/get: entrada nasce com buffers vazio', () => {
    const registry = createSimpleAudioRegistry()
    const entity = {}
    const audio = fakeAudio()

    registry.register(entity, audio)

    expect(registry.get(entity)).toEqual({ audio, buffers: [] })
  })

  it('register aceita `extra` mesclado na entrada', () => {
    const registry = createSimpleAudioRegistry()
    const entity = {}

    registry.register(entity, fakeAudio(), { previousAction: null, foo: 42 })

    const entry = registry.get(entity)
    expect(entry.previousAction).toBe(null)
    expect(entry.foo).toBe(42)
  })

  it('get de entidade nunca registrada devolve undefined', () => {
    const registry = createSimpleAudioRegistry()
    expect(registry.get({})).toBeUndefined()
  })

  it('unregister remove a entrada; entidade não registrada não quebra', () => {
    const registry = createSimpleAudioRegistry()
    const entity = {}
    registry.register(entity, fakeAudio())

    registry.unregister(entity)
    expect(registry.get(entity)).toBeUndefined()

    expect(() => registry.unregister({})).not.toThrow()
  })

  it('unregister para o áudio se estiver tocando, e desconecta', () => {
    const registry = createSimpleAudioRegistry()
    const entity = {}
    let stopped = false
    let disconnected = false
    const audio = {
      isPlaying: true,
      stop: () => {
        stopped = true
      },
      disconnect: () => {
        disconnected = true
      },
    }
    registry.register(entity, audio)

    registry.unregister(entity)

    expect(stopped).toBe(true)
    expect(disconnected).toBe(true)
  })

  it('all() itera todas as entradas registradas', () => {
    const registry = createSimpleAudioRegistry()
    const e1 = {}
    const e2 = {}
    registry.register(e1, fakeAudio())
    registry.register(e2, fakeAudio())

    const seen = new Map(registry.all())
    expect(seen.size).toBe(2)
    expect(seen.has(e1)).toBe(true)
    expect(seen.has(e2)).toBe(true)
  })

  it('duas instâncias da fábrica têm registries independentes', () => {
    const a = createSimpleAudioRegistry()
    const b = createSimpleAudioRegistry()
    const entity = {}
    a.register(entity, fakeAudio())

    expect(a.get(entity)).toBeDefined()
    expect(b.get(entity)).toBeUndefined()
  })
})
