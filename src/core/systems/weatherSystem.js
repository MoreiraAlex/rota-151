import { lightningStruck } from '../events'
import { GAME_CONFIG } from '../gameConfig'
import { cosmeticRng } from '../rng'
import { InputControlled, LocalWeather, Position, WorldClock } from '../traits'
import { stepWeatherLevels } from '../weather/weatherLevels'
import { weatherAt } from '../weather/worldWeather'

const between = ([min, max]) => min + cosmeticRng() * (max - min)

/**
 * Clima onde está quem o jogador controla (docs/features/048-dia-noite-e-
 * clima.md), fase `simulation`:
 *
 * - pergunta ao mapa de clima (`weatherAt`) o tipo e a força no lugar e na
 *   hora — ou usa o tipo fixado pelo debug (`forced`), na força cheia;
 * - leva a força de cada tipo aos poucos até o sorteado
 *   (`stepWeatherLevels`, `WEATHER.TRANSITION`);
 * - na tempestade, solta relâmpagos (`lightningStruck`) com o RNG
 *   cosmético: o intervalo conta mais devagar com a tempestade fraca.
 *
 * Lê `WorldClock` e a posição do controlado; escreve `LocalWeather` (traits
 * do mundo).
 */
export function weatherSystem({ world, delta, events }) {
  if (!world.has(LocalWeather) || !world.has(WorldClock)) return
  const controlled = world.queryFirst(InputControlled, Position)
  if (!controlled) return

  const { WEATHER } = GAME_CONFIG
  const current = world.get(LocalWeather)
  const { x, z } = controlled.get(Position)
  const drawn = current.forced
    ? { type: current.forced, intensity: 1 }
    : weatherAt(x, z, world.get(WorldClock).time)
  const levels = stepWeatherLevels(
    current,
    drawn.type,
    drawn.intensity,
    delta,
    WEATHER.TRANSITION,
  )

  let { lightningTimer } = current
  if (levels.storm > 0) {
    lightningTimer -= delta * levels.storm
    if (lightningTimer <= 0) {
      events?.emit(
        lightningStruck({
          thunderDelay: between(WEATHER.THUNDER_DELAY),
          strength: levels.storm,
        }),
      )
      lightningTimer = between(WEATHER.LIGHTNING_INTERVAL)
    }
  }

  world.set(LocalWeather, {
    ...current,
    ...levels,
    target: drawn.type,
    targetIntensity: drawn.intensity,
    lightningTimer,
  })
}
