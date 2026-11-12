import * as THREE from 'three'
import { MUSIC_TRACKS } from '@/core/data/audio/musicTracks'
import { getAudioListener } from './audioListener'
import { routeToChannel } from './audioMixer'
import { loadAudioBuffer } from './audioBufferCache'

/**
 * Tocador da música de fundo (docs/features/065-sons-do-mundo.md, Parte 2).
 * Quem decide o que e quando tocar é `musicSystem.js`; aqui só toca.
 *
 * - **Exploração**: uma música toca inteira, uma vez. Vem por streaming (um
 *   `<audio>` ligado no canal de música por um `THREE.Audio`), não
 *   decodificada inteira: uma música de alguns minutos decodificada ocupa
 *   dezenas de MB, pesado demais pro celular. Quando a luta começa, some em
 *   `fadeOut` s.
 * - **Batalha** (Parte 3): repete no loop medido, então é decodificada (o
 *   loop exato precisa do áudio inteiro na memória) e fica carregada desde
 *   o começo, pra entrar na hora. Quando a luta acaba, some em `fadeOut` s;
 *   se a luta volta durante o sumiço, sobe de novo de onde está.
 *
 * Estado de tela, não de jogo: um tocador por processo.
 */
let song = null

function getSong() {
  if (song) return song
  const element = new Audio()
  element.preload = 'auto'
  const audio = routeToChannel(new THREE.Audio(getAudioListener()), 'music')
  audio.setMediaElementSource(element)
  song = { element, audio, trackId: null, level: 0, fading: false }
  element.addEventListener('ended', () => finishSong(song))
  return song
}

function finishSong(current) {
  current.element.pause()
  current.element.removeAttribute('src')
  current.element.load()
  current.trackId = null
  current.level = 0
  current.fading = false
}

/** Se o áudio do navegador já foi liberado (primeiro clique). */
export function canPlayMusic() {
  return getAudioListener().context.state === 'running'
}

/** A música tocando agora (`null` = silêncio). */
export function currentSong() {
  return song?.trackId ?? null
}

/** Começa a música `trackId` do começo (a que tocava para na hora). */
export function playSong(trackId) {
  const current = getSong()
  const track = MUSIC_TRACKS[trackId]
  current.element.src = track.path
  current.trackId = trackId
  current.level = 1
  current.fading = false
  current.audio.setVolume(track.volume)
  // Se o navegador recusar (sem o clique ainda), conta como terminada: o
  // system espera o silêncio e tenta a próxima.
  current.element.play().catch(() => finishSong(current))
}

/** Faz a música de agora sumir aos poucos e parar. */
export function fadeOutSong() {
  if (song?.trackId) song.fading = true
}

/** Um frame: anda o fade da música interrompida. */
export function updateSong(delta, fadeOut) {
  if (!song?.trackId || !song.fading) return
  song.level = Math.max(0, song.level - delta / fadeOut)
  song.audio.setVolume(song.level * MUSIC_TRACKS[song.trackId].volume)
  if (song.level <= 0) finishSong(song)
}

/**
 * Uma música que repete (`loopStart`/`loopEnd` da faixa) enquanto dura uma
 * situação: a da batalha (docs/features/065-sons-do-mundo.md, Parte 3) e a
 * de um lugar, como o Pokécenter por dentro (docs/features/068-interior-
 * dos-predios.md). Inteira na memória (o trecho que repete precisa do
 * buffer), sobe e some aos poucos (`target`/`level`). Pedida com outra
 * faixa, a de antes para na hora e a nova começa.
 */
function createLoopedMusic() {
  let slot = null

  function slotFor(trackId) {
    if (slot?.trackId === trackId) return slot
    if (slot?.audio.isPlaying) slot.audio.stop()
    slot?.audio.disconnect()
    const track = MUSIC_TRACKS[trackId]
    const audio = routeToChannel(new THREE.Audio(getAudioListener()), 'music')
    audio.setLoop(true)
    audio.setLoopStart(track.loopStart)
    audio.setLoopEnd(track.loopEnd)
    slot = { audio, trackId, buffer: null, level: 0, target: 0 }
    const current = slot
    loadAudioBuffer(track.path).then((buffer) => {
      current.buffer = buffer
    })
    return slot
  }

  return {
    preload(trackId) {
      slotFor(trackId)
    },
    isPlaying: () => !!slot?.audio.isPlaying,
    // Do começo se estava parada, ou subindo de volta se estava sumindo.
    // Devolve se está tocando.
    start(trackId) {
      const current = slotFor(trackId)
      current.target = 1
      if (current.audio.isPlaying) return true
      if (!current.buffer) return false
      current.audio.setBuffer(current.buffer)
      current.level = 1
      current.audio.setVolume(MUSIC_TRACKS[current.trackId].volume)
      current.audio.play()
      return true
    },
    stop() {
      if (slot) slot.target = 0
    },
    update(delta, fadeOut) {
      if (!slot?.audio.isPlaying) return
      const step = delta / fadeOut
      slot.level =
        slot.target > slot.level
          ? Math.min(slot.target, slot.level + step)
          : Math.max(slot.target, slot.level - step)
      slot.audio.setVolume(slot.level * MUSIC_TRACKS[slot.trackId].volume)
      if (slot.level <= 0) slot.audio.stop()
    },
    dispose() {
      if (slot?.audio.isPlaying) slot.audio.stop()
      slot = null
    },
  }
}

const battle = createLoopedMusic()
const place = createLoopedMusic()

/** Carrega a música de batalha `trackId` antes da primeira luta. */
export const preloadBattleMusic = battle.preload
/** Se a música de batalha está tocando (inclusive sumindo). */
export const battleMusicPlaying = battle.isPlaying
/** Põe a música de batalha `trackId` pra tocar (ou subir de volta). */
export const startBattleMusic = battle.start
/** Faz a música de batalha sumir aos poucos e parar. */
export const stopBattleMusic = battle.stop
/** Um frame: anda o sumiço (ou a volta) da música de batalha. */
export const updateBattleMusic = battle.update

/** Carrega a música do lugar `trackId` (068). */
export const preloadPlaceMusic = place.preload
/** Se a música de um lugar está tocando (inclusive sumindo). */
export const placeMusicPlaying = place.isPlaying
/** Põe a música do lugar `trackId` pra tocar (ou subir de volta). */
export const startPlaceMusic = place.start
/** Faz a música do lugar sumir aos poucos e parar. */
export const stopPlaceMusic = place.stop
/** Um frame: anda o sumiço (ou a volta) da música do lugar. */
export const updatePlaceMusic = place.update

/** Para tudo (a cena saiu). */
export function disposeMusic() {
  if (song) {
    finishSong(song)
    song.audio.disconnect()
    song = null
  }
  battle.dispose()
  place.dispose()
}
