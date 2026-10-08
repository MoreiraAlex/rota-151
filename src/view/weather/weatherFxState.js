/**
 * Estado de TELA do clima (docs/features/048-dia-noite-e-clima.md) — só
 * existe um no jogo inteiro, como `view/audio/ambientAudioState.js`:
 *
 * - `flashTime`/`flashStrength`: o clarão do relâmpago em curso (segundos
 *   que faltam e força). Escreve: `view/systems/lightningSystem.js`. Lê:
 *   `DayNightView.jsx`.
 * - `thunders`: trovões esperando o atraso (`{ timer, strength }`).
 *   Escreve e toca: `lightningSystem.js`.
 * - `audio`: os nós de som do clima (`rain`, `wind` em loop e os
 *   `thunders` para tocar) e os buffers do trovão. Monta:
 *   `view/audio/WeatherAudio.jsx`. Usa: `weatherAudioSystem.js` e
 *   `lightningSystem.js`.
 */
const state = {
  flashTime: 0,
  flashStrength: 0,
  thunders: [],
  audio: { rain: null, wind: null, thunder: null, thunderBuffers: [] },
}

export function getWeatherFxState() {
  return state
}

export function resetWeatherFxAudio() {
  state.audio = { rain: null, wind: null, thunder: null, thunderBuffers: [] }
  state.thunders = []
}
