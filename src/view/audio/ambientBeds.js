import * as THREE from 'three'
import { AMBIENT_BEDS, AMBIENT_ONE_SHOTS } from '@/core/data/audio/ambientBeds'
import { getAudioListener } from './audioListener'
import { routeToChannel } from './audioMixer'
import { loadAudioBuffer } from './audioBufferCache'
import { createPositionalAudio } from './spatialAudio'

/**
 * Estado do som ambiente (docs/features/065-sons-do-mundo.md, Parte 4) —
 * um só no jogo. Montado por `AmbientAudio.jsx`; quem decide volumes e
 * quando os avulsos tocam é `ambientBedSystem.js`.
 *
 * - **Fundos** (`beds`): um `THREE.Audio` em loop por fundo, no canal de
 *   ambiente. O áudio decodificado só existe enquanto o fundo pode soar:
 *   carrega quando o volume dele passa a ser pedido e é largado quando
 *   some (fora do `audioBufferCache`, que guarda pra sempre).
 * - **Avulsos** (`oneShots`): um áudio por som — com posição (preso num
 *   `Object3D` do grupo da cena) se o som tem `spatial`, sem posição senão.
 *   As variações ficam no cache (são curtas).
 */
const loader = new THREE.AudioLoader()

const state = {
  root: null,
  beds: {},
  oneShots: {},
  weights: {},
  probeTimer: 0,
}

export function getAmbientState() {
  return state
}

export function registerAmbientRoot(group) {
  state.root = group
  const listener = getAudioListener()
  for (const id of Object.keys(AMBIENT_BEDS)) {
    const audio = routeToChannel(new THREE.Audio(listener), 'ambient')
    audio.setLoop(true)
    audio.setVolume(0)
    state.beds[id] = { audio, level: 0, buffer: null, loading: false }
  }
  for (const [id, shot] of Object.entries(AMBIENT_ONE_SHOTS)) {
    const entry = { holder: null, audio: null, buffers: [], timer: 0 }
    if (shot.spatial) {
      entry.holder = new THREE.Object3D()
      entry.audio = createPositionalAudio(listener, {
        volume: shot.volume,
        refDistance: shot.spatial.refDistance,
        maxDistance: shot.spatial.maxDistance,
        channel: 'ambient',
      })
      entry.holder.add(entry.audio)
      group.add(entry.holder)
    } else {
      entry.audio = routeToChannel(new THREE.Audio(listener), 'ambient')
    }
    for (const path of shot.files) {
      loadAudioBuffer(path).then((buffer) => {
        if (buffer && state.oneShots[id] === entry) entry.buffers.push(buffer)
      })
    }
    state.oneShots[id] = entry
  }
}

export function unregisterAmbientRoot(group) {
  if (state.root !== group) return
  for (const bed of Object.values(state.beds)) {
    if (bed.audio.isPlaying) bed.audio.stop()
    bed.audio.disconnect()
  }
  for (const entry of Object.values(state.oneShots)) {
    if (entry.audio.isPlaying) entry.audio.stop()
    if (entry.holder) {
      entry.holder.remove(entry.audio)
      group.remove(entry.holder)
    }
  }
  state.root = null
  state.beds = {}
  state.oneShots = {}
  state.weights = {}
  state.probeTimer = 0
}

/** Começa a carregar o fundo `id` (uma vez). */
export function requestBed(id) {
  const bed = state.beds[id]
  if (!bed || bed.buffer || bed.loading) return
  bed.loading = true
  loader.load(
    AMBIENT_BEDS[id].path,
    (buffer) => {
      bed.loading = false
      if (state.beds[id] === bed) bed.buffer = buffer
    },
    undefined,
    () => {
      bed.loading = false
    },
  )
}

/** Para o fundo `id` e larga o áudio dele. */
export function releaseBed(id) {
  const bed = state.beds[id]
  if (!bed) return
  if (bed.audio.isPlaying) bed.audio.stop()
  bed.audio.buffer = null
  bed.buffer = null
  bed.level = 0
}
