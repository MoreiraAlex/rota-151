import * as THREE from 'three'
import { getAudioListener } from './audioListener'
import { loadAudioBuffer } from './audioBufferCache'
import { routeToChannel } from './audioMixer'
import { pickRandomVariation } from './pickRandomVariation'

/**
 * Sons de aviso, sem posição no mundo (docs/features/067-campo-de-treino-e-
 * avisos-de-nivel.md): poucos `THREE.Audio` no canal de efeitos, usados em
 * rodízio — o mais antigo é cortado se todos estiverem tocando. Estado de
 * tela.
 *
 * `playUiSound(sound, delay)` — `sound` é `{ files, volume }` (ex.:
 * `UI_SOUNDS.levelUp`); `delay` (s) adia o começo. Arquivo ainda carregando:
 * pede e não toca desta vez (`preloadUiSounds` evita isso).
 */
const VOICE_COUNT = 3
let voices = []
let next = 0
const buffers = new Map()

function ensureVoices() {
  if (voices.length) return voices
  const listener = getAudioListener()
  voices = Array.from({ length: VOICE_COUNT }, () =>
    routeToChannel(new THREE.Audio(listener), 'effects'),
  )
  return voices
}

/** Começa a carregar os arquivos de `sounds` (objeto de momentos). */
export function preloadUiSounds(sounds) {
  for (const sound of Object.values(sounds)) {
    for (const path of sound.files) loadInto(path)
  }
}

export function playUiSound(sound, delay = 0) {
  if (!sound || !(sound.volume > 0)) return
  const ready = sound.files.map((path) => buffers.get(path)).filter(Boolean)
  sound.files.forEach(loadInto)
  if (ready.length === 0) return

  const all = ensureVoices()
  const audio = all[next]
  next = (next + 1) % all.length
  if (audio.isPlaying) audio.stop()
  audio.setBuffer(pickRandomVariation(ready))
  audio.setVolume(sound.volume)
  audio.play(delay)
}

function loadInto(path) {
  if (buffers.has(path)) return
  buffers.set(path, null)
  loadAudioBuffer(path).then((buffer) => buffers.set(path, buffer))
}
