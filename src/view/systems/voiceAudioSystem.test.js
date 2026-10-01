import { afterEach, describe, expect, it } from 'vitest'
import { createWorld } from 'koota'
import { CryPulse, Fainted } from '@/core/traits'
import {
  getVoiceAudioEntry,
  registerVoiceAudio,
  unregisterVoiceAudio,
} from '@/view/registry/voiceAudioRegistry'
import { voiceAudioSystem } from './voiceAudioSystem'

// Nó de áudio falso — só o que o system/registry usam.
function fakeAudio() {
  return {
    isPlaying: false,
    plays: 0,
    setBuffer() {},
    play() {
      this.isPlaying = true
      this.plays += 1
    },
    stop() {
      this.isPlaying = false
    },
    disconnect() {},
  }
}

const worlds = []
const registered = []

function spawnVoiced() {
  const world = createWorld()
  worlds.push(world)
  const entity = world.spawn()
  const audio = fakeAudio()
  registerVoiceAudio(entity, audio, {
    minInterval: 1,
    maxInterval: 1,
    immediate: true,
  })
  getVoiceAudioEntry(entity).buffers.push({})
  registered.push(entity)
  return { entity, audio }
}

afterEach(() => {
  while (registered.length) unregisterVoiceAudio(registered.pop())
  while (worlds.length) worlds.pop().destroy()
})

describe('voiceAudioSystem', () => {
  it('controle: acordada, vocaliza', () => {
    const { audio } = spawnVoiced()

    voiceAudioSystem({ delta: 0.1 })

    expect(audio.plays).toBe(1)
  })

  it('desmaiada não vocaliza', () => {
    const { entity, audio } = spawnVoiced()
    entity.add(Fainted)

    for (let i = 0; i < 100; i++) voiceAudioSystem({ delta: 0.1 })

    expect(audio.plays).toBe(0)
  })

  it('desmaiou no meio de uma vocalização: corta na hora', () => {
    const { entity, audio } = spawnVoiced()
    voiceAudioSystem({ delta: 0.1 })
    expect(audio.isPlaying).toBe(true)

    entity.add(Fainted)
    voiceAudioSystem({ delta: 0.1 })

    expect(audio.isPlaying).toBe(false)
  })

  describe('CryPulse (skill com audio.cry, ex.: Growl)', () => {
    it('vocaliza NA HORA, sem esperar o temporizador, e consome o pulso', () => {
      const { entity, audio } = spawnVoiced()
      getVoiceAudioEntry(entity).timer = 999

      entity.add(CryPulse)
      voiceAudioSystem({ delta: 1 / 60 })

      expect(audio.plays).toBe(1)
      expect(entity.has(CryPulse)).toBe(false)
    })

    it('corta a vocalização que já estava tocando e começa a do golpe', () => {
      const { entity, audio } = spawnVoiced()
      audio.isPlaying = true
      let stopped = 0
      audio.stop = () => {
        stopped += 1
        audio.isPlaying = false
      }

      entity.add(CryPulse)
      voiceAudioSystem({ delta: 1 / 60 })

      expect(stopped).toBe(1)
      expect(audio.plays).toBe(1)
    })

    it('sorteia o próximo intervalo da voz periódica a partir daí', () => {
      const { entity } = spawnVoiced()
      getVoiceAudioEntry(entity).timer = 0.01

      entity.add(CryPulse)
      voiceAudioSystem({ delta: 1 / 60 })

      // minInterval = maxInterval = 1
      expect(getVoiceAudioEntry(entity).timer).toBeCloseTo(1)
    })

    it('sem buffer carregado ainda, consome o pulso e não toca nada', () => {
      const { entity, audio } = spawnVoiced()
      getVoiceAudioEntry(entity).buffers.length = 0

      entity.add(CryPulse)
      voiceAudioSystem({ delta: 1 / 60 })

      expect(audio.plays).toBe(0)
      expect(entity.has(CryPulse)).toBe(false)
    })

    it('sem o pulso, a voz periódica segue o seu ritmo (regressão)', () => {
      const { audio } = spawnVoiced()

      voiceAudioSystem({ delta: 1 / 60 })

      expect(audio.plays).toBe(1) // `immediate`: timer em 0
    })
  })
})
