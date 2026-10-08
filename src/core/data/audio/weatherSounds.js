/**
 * Sons do clima (docs/features/048-dia-noite-e-clima.md), tocados por
 * `view/audio/WeatherAudio.jsx`:
 *
 * - `rain`: chuva em loop ("Rain (loopable)", Ylmir, OpenGameArt, CC0) —
 *   uma variação por sessão;
 * - `wind`: vento forte em loop (tempestade e neve), do Cobblemon;
 * - `thunder`: trovão depois do relâmpago, do golpe Thunder do Cobblemon
 *   (em teste — trocar se não servir).
 */
export const WEATHER_SOUNDS = {
  rain: [
    '/assets/audio/ambient/rain-01.ogg',
    '/assets/audio/ambient/rain-02.ogg',
    '/assets/audio/ambient/rain-03.ogg',
    '/assets/audio/ambient/rain-04.ogg',
  ],
  wind: ['/assets/audio/ambient/strong-wind.ogg'],
  thunder: [
    '/assets/audio/ambient/thunder-01.ogg',
    '/assets/audio/ambient/thunder-02.ogg',
  ],
}
