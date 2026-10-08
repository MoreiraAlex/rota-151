import * as THREE from 'three'
import { getAudioListener } from './audioListener'
import { loadAudioBuffer } from './audioBufferCache'
import { pickRandomVariation } from './pickRandomVariation'

/**
 * Sons pontuais num ponto do mundo, sem entidade pra carregar o áudio (a
 * Pokébola, docs/features/043-captura.md): um conjunto fixo de
 * `THREE.PositionalAudio` presos no grupo da cena (`WorldSoundsView.jsx`),
 * usados em rodízio — o mais antigo é cortado se todos estiverem tocando.
 * Estado de tela.
 *
 * `playWorldSound(sound, position)` — `sound` é `{ files, volume,
 * refDistance }` (ex.: `POKEBALL_SOUNDS.throw`). Arquivo ainda carregando:
 * pede e não toca desta vez (`preloadWorldSounds` evita isso).
 */
const VOICE_COUNT = 8
let root = null
let voices = []
let next = 0
const buffers = new Map()

export function registerWorldSoundsRoot(group) {
  root = group
  voices = Array.from({ length: VOICE_COUNT }, () => {
    const holder = new THREE.Object3D()
    const audio = new THREE.PositionalAudio(getAudioListener())
    holder.add(audio)
    group.add(holder)
    return { holder, audio }
  })
}

export function unregisterWorldSoundsRoot(group) {
  if (root !== group) return
  for (const { holder, audio } of voices) {
    if (audio.isPlaying) audio.stop()
    holder.remove(audio)
    group.remove(holder)
  }
  voices = []
  root = null
}

/** Começa a carregar os arquivos de `sounds` (objeto de momentos). */
export function preloadWorldSounds(sounds) {
  for (const sound of Object.values(sounds)) {
    for (const path of sound.files) loadInto(path)
  }
}

export function playWorldSound(sound, position) {
  if (!sound || !(sound.volume > 0) || voices.length === 0 || !position) return
  const ready = sound.files.map((path) => buffers.get(path)).filter(Boolean)
  sound.files.forEach(loadInto)
  if (ready.length === 0) return

  const voice = voices[next]
  next = (next + 1) % voices.length
  if (voice.audio.isPlaying) voice.audio.stop()
  voice.holder.position.set(position.x, position.y, position.z)
  voice.audio.setBuffer(pickRandomVariation(ready))
  voice.audio.setVolume(sound.volume)
  voice.audio.setRefDistance(sound.refDistance ?? 6)
  voice.audio.play()
}

function loadInto(path) {
  if (buffers.has(path)) return
  buffers.set(path, null)
  loadAudioBuffer(path).then((buffer) => buffers.set(path, buffer))
}
