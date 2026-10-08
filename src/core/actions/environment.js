import { LocalWeather, WorldClock } from '../traits'
import { WEATHER_TYPES } from '../weather/weatherMap'

/**
 * Relógio e clima do mundo (docs/features/048-dia-noite-e-clima.md). Os
 * dois são traits do MUNDO (`world.get`), não de entidade.
 */

/** Põe o relógio do mundo no horário `time` (dias de jogo, ≥ 0). */
export function definirHorario(world, time) {
  if (!world.has(WorldClock) || !Number.isFinite(time) || time < 0) return
  world.set(WorldClock, { ...world.get(WorldClock), time })
}

/** Quanto o relógio anda por segundo de jogo (`0` = parado). Debug. */
export function definirVelocidadeDoRelogio(world, speed) {
  if (!world.has(WorldClock) || !Number.isFinite(speed) || speed < 0) return
  world.set(WorldClock, { ...world.get(WorldClock), speed })
}

/**
 * Fixa o clima num tipo (`null` = volta a seguir o mapa). Debug: testar
 * chuva ou neve sem esperar o sorteio. A troca também é gradual.
 */
export function forcarClima(world, type) {
  if (!world.has(LocalWeather)) return
  if (type !== null && !WEATHER_TYPES.includes(type)) return
  world.set(LocalWeather, { ...world.get(LocalWeather), forced: type })
}
