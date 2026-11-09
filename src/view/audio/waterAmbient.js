import * as THREE from 'three'
import { WATER_AMBIENT } from '@/core/data/audio/waterSounds'
import { createPositionalAudio } from './spatialAudio'
import { getAudioListener } from './audioListener'
import { loadAudioBuffer } from './audioBufferCache'

/**
 * Som de fundo da água (docs/features/065-sons-do-mundo.md, Parte 5): um
 * `PositionalAudio` em loop por tipo (`lake`, `river`), no canal de
 * ambiente, preso num `Object3D` no grupo da cena (`WaterAmbientView.jsx`).
 * Quem acha a água e move os sons é `waterAmbientSystem.js`. Estado de
 * tela, um só.
 */
export const WATER_KINDS = ['lake', 'river']

const state = { root: null, voices: {}, probeTimer: 0, targets: {} }

export function getWaterAmbientState() {
  return state
}

export function registerWaterAmbientRoot(group) {
  state.root = group
  for (const kind of WATER_KINDS) {
    const sound = WATER_AMBIENT[kind]
    const holder = new THREE.Object3D()
    const audio = createPositionalAudio(getAudioListener(), {
      volume: sound.volume,
      refDistance: sound.refDistance,
      maxDistance: sound.maxDistance,
      channel: 'ambient',
    })
    audio.setLoop(true)
    holder.add(audio)
    group.add(holder)
    const voice = { holder, audio, placed: false }
    state.voices[kind] = voice
    loadAudioBuffer(sound.path).then((buffer) => {
      if (buffer && state.voices[kind] === voice) audio.setBuffer(buffer)
    })
  }
}

export function unregisterWaterAmbientRoot(group) {
  if (state.root !== group) return
  for (const { holder, audio } of Object.values(state.voices)) {
    if (audio.isPlaying) audio.stop()
    holder.remove(audio)
    group.remove(holder)
  }
  state.root = null
  state.voices = {}
  state.targets = {}
  state.probeTimer = 0
}
