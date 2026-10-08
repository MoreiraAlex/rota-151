'use client'

import { useEffect } from 'react'
import * as THREE from 'three'
import { WEATHER_SOUNDS } from '@/core/data/audio/weatherSounds'
import { getAudioListener } from './audioListener'
import { loadAudioBuffer } from './audioBufferCache'
import { pickRandomVariation } from './pickRandomVariation'
import {
  getWeatherFxState,
  resetWeatherFxAudio,
} from '@/view/weather/weatherFxState'

/**
 * Sons do clima (docs/features/048-dia-noite-e-clima.md): monta os nós e
 * carrega os arquivos de `WEATHER_SOUNDS` — a chuva e o vento forte em loop
 * (uma variação de chuva sorteada por sessão) e o trovão. Quem mexe no
 * volume é `view/systems/weatherAudioSystem.js`; quem toca o trovão,
 * `lightningSystem.js`. Sem visual nenhum; monta uma vez em
 * `GameScene.jsx`. Não é posicional (o clima está em todo lugar).
 *
 * O desbloqueio do áudio do browser é o de `AmbientAudio.jsx` (o listener
 * é o mesmo).
 */
export function WeatherAudio() {
  useEffect(() => {
    const listener = getAudioListener()
    const makeLoop = () => {
      const audio = new THREE.Audio(listener)
      audio.setLoop(true)
      audio.setVolume(0)
      return audio
    }
    const rain = makeLoop()
    const wind = makeLoop()
    const thunder = new THREE.Audio(listener)
    const audio = getWeatherFxState().audio
    audio.rain = rain
    audio.wind = wind
    audio.thunder = thunder

    let cancelled = false
    const loadInto = (node, path) =>
      loadAudioBuffer(path).then((buffer) => {
        if (!cancelled && buffer) node.setBuffer(buffer)
      })
    loadInto(rain, pickRandomVariation(WEATHER_SOUNDS.rain))
    loadInto(wind, pickRandomVariation(WEATHER_SOUNDS.wind))
    for (const path of WEATHER_SOUNDS.thunder) {
      loadAudioBuffer(path).then((buffer) => {
        if (!cancelled && buffer) audio.thunderBuffers.push(buffer)
      })
    }

    return () => {
      cancelled = true
      for (const node of [rain, wind, thunder]) {
        if (node.isPlaying) node.stop()
        node.disconnect()
      }
      resetWeatherFxAudio()
    }
  }, [])

  return null
}
