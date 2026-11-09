import { TEST_LEVEL } from '@/core/data/testLevel'
import { MUSIC } from '@/core/data/audio/musicTracks'
import {
  musicPool,
  pickTrack,
  randomBetween,
  silenceDuration,
} from '@/core/audio/music'
import { advanceBattleHold, isGroupInBattle } from '@/core/audio/battleMusic'
import { resolveLocalTrainer } from '@/core/actions/owner'
import { isDaytime } from '@/core/time/dayCycle'
import {
  InputControlled,
  Party,
  Position,
  SoundSettings,
  WorldClock,
} from '@/core/traits'
import {
  battleMusicPlaying,
  canPlayMusic,
  currentSong,
  fadeOutSong,
  playSong,
  preloadBattleMusic,
  startBattleMusic,
  stopBattleMusic,
  updateBattleMusic,
  updateSong,
} from '@/view/audio/musicPlayer'

/**
 * Música de fundo no estilo do Minecraft (docs/features/065-sons-do-
 * mundo.md, Parte 2), fase `presentation`:
 *
 * 1. Ao entrar no mundo, espera um pouco (`MUSIC.FIRST_DELAY`).
 * 2. Sorteia uma música da lista do bioma e da hora de quem o jogador
 *    controla (treinador ou a criatura no controle), sem repetir a última,
 *    e toca inteira.
 * 3. Terminou: silêncio sorteado pela frequência que o jogador escolheu
 *    (`SoundSettings.musicFrequency`), e volta ao 2.
 *
 * Mudar de bioma ou de hora não corta a música: só vale pra próxima. Se o
 * jogador troca a frequência no meio do silêncio, a espera nunca fica maior
 * que um sorteio da frequência nova (pôr em "sempre" faz a música voltar
 * logo).
 *
 * **Batalha** (Parte 3): começou uma luta do grupo do jogador
 * (`isGroupInBattle`), a música de exploração some e a de batalha entra; a
 * espera do ciclo fica parada. A luta acabou e passou `MUSIC.BATTLE_HOLD`:
 * a de batalha some e começa o silêncio, como depois de qualquer música.
 *
 * Música é cosmética: o sorteio usa `Math.random`. Estado de tela, um só.
 */
const state = {
  timer: null,
  lastTrackId: null,
  frequency: null,
  wasPlaying: false,
  battle: null,
}

export function musicSystem({ world, delta }) {
  updateSong(delta, MUSIC.FADE_OUT)
  updateBattleMusic(delta, MUSIC.FADE_OUT)
  if (!canPlayMusic()) return
  preloadBattleMusic(MUSIC.BATTLE_TRACK)

  const inBattle = isGroupInBattle(world, resolveLocalTrainer(world))
  state.battle = advanceBattleHold(
    state.battle,
    inBattle,
    delta,
    MUSIC.BATTLE_HOLD,
  )
  if (state.battle.active) {
    fadeOutSong()
    startBattleMusic(MUSIC.BATTLE_TRACK)
    state.wasPlaying = true
    return
  }
  stopBattleMusic()

  const frequency = world
    .queryFirst(Party, SoundSettings)
    ?.get(SoundSettings)?.musicFrequency
  if (state.timer === null) {
    state.timer = randomBetween(MUSIC.FIRST_DELAY, Math.random)
  } else if (frequency !== state.frequency && state.frequency !== null) {
    state.timer = Math.min(state.timer, silenceDuration(frequency, Math.random))
  }
  state.frequency = frequency

  // A de batalha sumindo conta como tocando: o silêncio começa quando ela
  // acaba.
  const playing = currentSong() !== null || battleMusicPlaying()
  if (playing) {
    state.wasPlaying = true
    return
  }
  if (state.wasPlaying) {
    // Acabou agora: começa o silêncio.
    state.wasPlaying = false
    state.timer = silenceDuration(frequency, Math.random)
  }

  state.timer -= delta
  if (state.timer > 0) return

  const trackId = nextTrack(world)
  if (!trackId) return
  playSong(trackId)
  state.lastTrackId = trackId
  state.wasPlaying = true
}

function nextTrack(world) {
  const focus = world.queryFirst(InputControlled, Position)
  if (!focus || !world.has(WorldClock)) return null
  const { x, z } = focus.get(Position)
  const biomeId = TEST_LEVEL.terrain.biomeAt(x, z)?.id
  const isDay = isDaytime(world.get(WorldClock).time)
  return pickTrack(musicPool(biomeId, isDay), state.lastTrackId, Math.random)
}

/** Volta ao começo (a cena saiu): a próxima entrada espera de novo. */
export function resetMusicSystem() {
  state.timer = null
  state.lastTrackId = null
  state.frequency = null
  state.wasPlaying = false
  state.battle = null
}
