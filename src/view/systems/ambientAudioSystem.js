import { getAmbientAudioState } from '@/view/audio/ambientAudioState'
import { pickRandomVariation } from '@/view/audio/pickRandomVariation'

/**
 * Toca o som ambiente esporádico (ver `view/audio/AmbientAudio.jsx`) —
 * mesmo esquema de `voiceAudioSystem.js` (timer decrescido por `delta`,
 * toca variação aleatória ao chegar em zero, sorteia um novo intervalo),
 * só que GLOBAL: lê o estado único de `ambientAudioState.js`, não um
 * registry por entidade — não há "quem" no mundo pra esse som.
 *
 * Sem `TEST_LEVEL.ambientSound` (`state.audio` nulo, `AmbientAudio.jsx`
 * nunca preencheu o estado), no-op. Já tocando, o timer não conta — deixa
 * a rajada atual terminar antes de contar o intervalo até a próxima.
 *
 * Vive na view (mexe em nó Three de áudio). Fase: presentation, perto de
 * `voiceAudioSystem` (mesma família — sem dependência real de ordem).
 */
export function ambientAudioSystem(context) {
  const { delta } = context
  const state = getAmbientAudioState()
  if (!state.audio) return
  if (state.audio.isPlaying) return

  state.timer -= delta
  if (state.timer > 0) return
  if (state.buffers.length === 0) return

  const buffer = pickRandomVariation(state.buffers)
  state.audio.setBuffer(buffer)
  state.audio.play()

  state.timer =
    state.minInterval + Math.random() * (state.maxInterval - state.minInterval)
}
