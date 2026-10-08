import { GAME_CONFIG } from '@/core/gameConfig'
import { LocalWeather } from '@/core/traits'
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

  setLoopVolume(rain, Math.min(1, weather.rain + weather.storm) * RAIN_VOLUME)
  setLoopVolume(wind, Math.min(1, weather.storm + weather.snow) * WIND_VOLUME)
}

function setLoopVolume(audio, volume) {
  if (!audio?.buffer) return
  audio.setVolume(volume)
  if (volume > 0 && !audio.isPlaying) audio.play()
  else if (volume <= 0 && audio.isPlaying) audio.pause()
}
