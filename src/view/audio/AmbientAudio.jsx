'use client'

import { useEffect } from 'react'
import * as THREE from 'three'
import { TEST_LEVEL } from '@/core/data/testLevel'
import {
  resolveAmbientSound,
  DEFAULT_AMBIENT_MIN_INTERVAL,
  DEFAULT_AMBIENT_MAX_INTERVAL,
} from '@/core/data/audio/ambientSound'
import { getAudioListener } from './audioListener'
import { loadAudioBuffer } from './audioBufferCache'
import {
  getAmbientAudioState,
  resetAmbientAudioState,
} from './ambientAudioState'

const DEFAULT_AMBIENT_VOLUME = 0.5

/**
 * Som ambiente ESPORÁDICO do nível (`TEST_LEVEL.ambientSound`) — não uma
 * faixa em loop contínuo (os arquivos reais disponíveis são rajadas de
 * vento de poucos segundos; em loop soariam obviamente repetitivos, ver
 * docstring de `core/data/audio/ambientSound.js`). Toca uma variação
 * aleatória de vez em quando, em intervalo também aleatório — mesmo
 * mecanismo de `voiceAudioSystem.js`, só que GLOBAL (um estado só,
 * `ambientAudioState.js`, não um registry por entidade) e não posicional
 * (`THREE.Audio`, não `PositionalAudio` — sem fonte física no mundo).
 * `view/systems/ambientAudioSystem.js` decide QUANDO tocar; este
 * componente só monta o nó, carrega os buffers e cuida do desbloqueio de
 * autoplay do browser.
 *
 * Componente sem visual nenhum, monta uma vez em `GameScene.jsx`. Sem
 * `TEST_LEVEL.ambientSound`, não faz nada, silenciosamente.
 *
 * Autoplay do browser: um `AudioContext` só toca depois de um gesto real
 * do usuário. O `AudioListener` (`getAudioListener()`) é COMPARTILHADO
 * por som de passo/voz/ambiente (é o único listener do jogo) — retomar o
 * contexto aqui desbloqueia os três de uma vez, não só o ambiente. Em vez
 * de acoplar isso a `platform/input/pointerInput.js` (que não devia saber
 * de áudio), um `pointerdown` capturado uma única vez (`{ once: true }`)
 * aqui resolve.
 */
export function AmbientAudio() {
  useEffect(() => {
    const ambient = resolveAmbientSound(TEST_LEVEL)
    if (!ambient) return

    const listener = getAudioListener()
    const audio = new THREE.Audio(listener)
    audio.setVolume(ambient.volume ?? DEFAULT_AMBIENT_VOLUME)

    const state = getAmbientAudioState()
    state.audio = audio
    state.minInterval = ambient.minInterval ?? DEFAULT_AMBIENT_MIN_INTERVAL
    state.maxInterval = ambient.maxInterval ?? DEFAULT_AMBIENT_MAX_INTERVAL
    state.timer =
      state.minInterval +
      Math.random() * (state.maxInterval - state.minInterval)

    // Mesmo esquema do som de passo/voz — carrega cada variação em
    // paralelo e preenche o estado IN PLACE conforme cada uma termina.
    let cancelled = false
    for (const path of ambient.clips ?? []) {
      loadAudioBuffer(path).then((buffer) => {
        if (cancelled || !buffer) return
        state.buffers.push(buffer)
      })
    }

    const startOnGesture = () => listener.context.resume()
    window.addEventListener('pointerdown', startOnGesture, { once: true })

    return () => {
      cancelled = true
      window.removeEventListener('pointerdown', startOnGesture)
      if (audio.isPlaying) audio.stop()
      audio.disconnect()
      resetAmbientAudioState()
    }
  }, [])

  return null
}
