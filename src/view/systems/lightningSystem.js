import { EVENT_TYPES } from '@/core/events'
import { GAME_CONFIG } from '@/core/gameConfig'
import { pickRandomVariation } from '@/view/audio/pickRandomVariation'
import { getWeatherFxState } from '@/view/weather/weatherFxState'

/**
 * Relâmpagos (docs/features/048-dia-noite-e-clima.md), fase
 * `presentation`: cada `lightningStruck` do frame acende o clarão (lido por
 * `DayNightView.jsx`) e agenda o trovão para depois do atraso do evento.
 * Conta o clarão e os atrasos pelo `delta` e toca o trovão quando chega a
 * hora (se o som já carregou — sem ele, só o clarão).
 */
export function lightningSystem({ delta, frameEvents = [] }) {
  const { FLASH_DURATION, THUNDER_VOLUME } = GAME_CONFIG.WEATHER
  const state = getWeatherFxState()

  for (const event of frameEvents) {
    if (event.type !== EVENT_TYPES.LIGHTNING_STRUCK) continue
    state.flashTime = FLASH_DURATION
    state.flashStrength = event.strength
    state.thunders.push({ timer: event.thunderDelay, strength: event.strength })
  }

  state.flashTime = Math.max(0, state.flashTime - delta)

  const { thunder, thunderBuffers } = state.audio
  for (const pending of state.thunders) pending.timer -= delta
  const due = state.thunders.filter((pending) => pending.timer <= 0)
  if (due.length === 0) return
  state.thunders = state.thunders.filter((pending) => pending.timer > 0)
  if (!thunder || thunderBuffers.length === 0) return

  const strength = Math.max(...due.map((pending) => pending.strength))
  if (thunder.isPlaying) thunder.stop()
  thunder.setBuffer(pickRandomVariation(thunderBuffers))
  thunder.setVolume(THUNDER_VOLUME * strength)
  thunder.play()
}

/**
 * Força do clarão agora (0 a 1): acende de uma vez e apaga até o fim de
 * `FLASH_DURATION`, com uma piscada no meio.
 */
export function flashLevel(state = getWeatherFxState()) {
  const { FLASH_DURATION } = GAME_CONFIG.WEATHER
  if (state.flashTime <= 0) return 0
  const left = state.flashTime / FLASH_DURATION
  const flicker = left > 0.45 && left < 0.6 ? 0.35 : 1
  return state.flashStrength * left * flicker
}
