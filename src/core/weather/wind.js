import { GAME_CONFIG } from '../gameConfig'
import { WEATHER_TYPES } from './weatherMap'

/**
 * Força do vento que balança a vegetação (docs/features/049-vegetacao-
 * e-floresta.md): a do tempo limpo (`WIND.STRENGTH.clear`) puxada para a de
 * cada clima pela força atual dele no `LocalWeather` — uma chuva fraca
 * venta pouco mais que o limpo, só a cheia venta o `STRENGTH` inteiro. Na
 * troca de clima, o vento muda aos poucos junto com ele.
 *
 * @param {Record<string, number>} levels - força de cada tipo (0 a 1)
 * @returns {number}
 */
export function windStrengthOf(levels, params = GAME_CONFIG.WIND) {
  const calm = params.STRENGTH.clear
  let strength = calm
  for (const type of WEATHER_TYPES) {
    if (type === 'clear') continue
    strength += (levels[type] ?? 0) * (params.STRENGTH[type] - calm)
  }
  return strength
}
