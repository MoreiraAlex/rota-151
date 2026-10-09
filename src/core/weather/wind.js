import { GAME_CONFIG } from '../gameConfig'
import { WEATHER_TYPES } from './weatherMap'

/**
 * Força do vento que balança a vegetação (docs/features/049-vegetacao-
 * e-floresta.md): a de cada clima (`WIND.STRENGTH`) misturada pela força
 * atual de cada tipo no `LocalWeather` — na troca de clima, o vento muda
 * aos poucos junto com ele. Sem força nenhuma (antes do primeiro tick), a
 * do tempo limpo.
 *
 * @param {Record<string, number>} levels - força de cada tipo (0 a 1)
 * @returns {number}
 */
export function windStrengthOf(levels, params = GAME_CONFIG.WIND) {
  let weighted = 0
  let total = 0
  for (const type of WEATHER_TYPES) {
    const level = levels[type] ?? 0
    weighted += level * params.STRENGTH[type]
    total += level
  }
  return total > 0 ? weighted / total : params.STRENGTH.clear
}
