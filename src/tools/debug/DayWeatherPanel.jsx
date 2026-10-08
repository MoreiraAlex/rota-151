'use client'

import { useEffect } from 'react'
import GUI from 'lil-gui'
import {
  definirHorario,
  definirVelocidadeDoRelogio,
  forcarClima,
} from '@/core/actions'
import { hourOf } from '@/core/time/dayCycle'
import { LocalWeather, WorldClock } from '@/core/traits'
import { WEATHER_TYPES } from '@/core/weather/weatherMap'
import { world } from '@/core/world/world'
import { GAME_CONFIG } from '@/core/gameConfig'
import { WEATHER_LABELS } from './dayWeatherLabels'

const HOURS = 24
// Velocidades do relógio (vezes a normal).
const SPEEDS = { parado: 0, '1×': 1, '10×': 10, '60×': 60, '600×': 600 }
const AUTOMATIC = 'auto'
const WEATHER_OPTIONS = {
  automático: AUTOMATIC,
  ...Object.fromEntries(WEATHER_TYPES.map((t) => [WEATHER_LABELS[t], t])),
}
// Nuvens (`GAME_CONFIG.CLOUDS`): [mín, máx, passo]. Mexem na config ao
// vivo (só nesta sessão); o céu lê a cada frame.
const CLOUD_CONTROLS = {
  COVER: { label: 'Cobertura (limpo)', range: [0, 1, 0.01] },
  OVERCAST_COVER: { label: 'Cobertura (fechado)', range: [0, 1, 0.01] },
  SIZE: { label: 'Tamanho', range: [0.2, 4, 0.05] },
  SOFTNESS: { label: 'Borda', range: [0.01, 1, 0.01] },
  OPACITY: { label: 'Opacidade', range: [0, 1, 0.01] },
  SPEED: { label: 'Velocidade', range: [0, 0.1, 0.001] },
  DIRECTION: { label: 'Direção (rad)', range: [0, Math.PI * 2, 0.01] },
}
// Ao lado do painel "Terreno" (os dois `lil-gui` nascem no canto direito).
const PANEL_RIGHT = '260px'

/**
 * Debug (F2, montado por `src/app/(auth)/page.js`): painel "Dia e clima"
 * (docs/features/048-dia-noite-e-clima.md) — escolher a hora do dia,
 * acelerar ou parar o relógio e forçar um clima, para testar sem esperar;
 * e ajustar as nuvens ("Copiar valores" leva os números para o
 * `gameConfig.js`).
 * A hora escolhida fica no mesmo dia de jogo (o período do clima conta
 * pelo tempo total).
 */
export function DayWeatherPanel() {
  useEffect(() => {
    const gui = new GUI({ title: 'Dia e clima' })
    gui.domElement.style.right = PANEL_RIGHT
    // Digitar nos campos não pode virar comando do jogo.
    const keepKeysInPanel = (event) => event.stopPropagation()
    gui.domElement.addEventListener('keydown', keepKeysInPanel)
    gui.domElement.addEventListener('keyup', keepKeysInPanel)

    const state = {
      get hour() {
        return hourOf(world.get(WorldClock).time)
      },
      set hour(hour) {
        const { time } = world.get(WorldClock)
        definirHorario(world, Math.floor(time) + hour / HOURS)
      },
      get speed() {
        return world.get(WorldClock).speed
      },
      set speed(speed) {
        definirVelocidadeDoRelogio(world, Number(speed))
      },
      get weather() {
        return world.get(LocalWeather).forced ?? AUTOMATIC
      },
      set weather(type) {
        forcarClima(world, type === AUTOMATIC ? null : type)
      },
    }

    gui
      .add(state, 'hour', 0, HOURS - 0.01, 0.05)
      .name('Hora')
      .listen()
    gui.add(state, 'speed', SPEEDS).name('Velocidade').listen()
    gui.add(state, 'weather', WEATHER_OPTIONS).name('Clima').listen()

    const cloudFolder = gui.addFolder('Nuvens')
    for (const [key, { label, range }] of Object.entries(CLOUD_CONTROLS)) {
      cloudFolder.add(GAME_CONFIG.CLOUDS, key, ...range).name(label)
    }
    cloudFolder
      .add(
        {
          copiar: () =>
            navigator.clipboard?.writeText(
              `CLOUDS: ${JSON.stringify(GAME_CONFIG.CLOUDS, null, 2)}`,
            ),
        },
        'copiar',
      )
      .name('Copiar valores')

    return () => gui.destroy()
  }, [])

  return null
}
