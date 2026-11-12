import { GAME_CONFIG } from '@/core/gameConfig'
import { Indoors, LocalWeather, Party } from '@/core/traits'
import { getWeatherFxState } from '@/view/weather/weatherFxState'

/**
 * Volume dos sons do clima (docs/features/048-dia-noite-e-clima.md), fase
 * `presentation`: a chuva toca com a força da chuva e da tempestade; o vento
 * forte, com a da tempestade e da neve. A força já muda aos poucos
 * (`weatherSystem`), então o volume acompanha sem salto. Os loops só ficam
 * tocando enquanto têm volume.
 */
export function weatherAudioSystem({ world }) {
  if (!world.has(LocalWeather)) return
  const { rain, wind } = getWeatherFxState().audio
  const weather = world.get(LocalWeather)
  const { RAIN_VOLUME, WIND_VOLUME } = GAME_CONFIG.WEATHER
  // Dentro de um prédio, abafados (docs/features/068-interior-dos-
  // predios.md).
  const indoors = world.queryFirst(Party)?.has(Indoors)
  const muffle = indoors ? GAME_CONFIG.INTERIOR.RAIN_VOLUME : 1

  setLoopVolume(
    rain,
    Math.min(1, weather.rain + weather.storm) * RAIN_VOLUME * muffle,
  )
  setLoopVolume(
    wind,
    Math.min(1, weather.storm + weather.snow) * WIND_VOLUME * muffle,
  )
}

function setLoopVolume(audio, volume) {
  if (!audio?.buffer) return
  audio.setVolume(volume)
  if (volume > 0 && !audio.isPlaying) audio.play()
  else if (volume <= 0 && audio.isPlaying) audio.pause()
}
