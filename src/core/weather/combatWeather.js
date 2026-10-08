import { LocalWeather, WorldClock } from '../traits'
import { weatherAt } from './worldWeather'

/**
 * Clima no combate (docs/features/048-dia-noite-e-clima.md): qual clima vale
 * no lugar de um golpe. Os multiplicadores ficam em `weatherModifiers.js`.
 */

/**
 * Tipo de clima em `(x, z)` agora: o do mapa (`weatherAt`, pela hora do
 * mundo) — ou o forçado pelo debug, que vale para o mundo todo. Sem relógio
 * (mundo de teste sem os traits), `'clear'`.
 */
export function combatWeatherAt(world, { x, z }) {
  if (!world.has(WorldClock)) return 'clear'
  const forced = world.has(LocalWeather) ? world.get(LocalWeather).forced : null
  if (forced) return forced
  return weatherAt(x, z, world.get(WorldClock).time).type
}
