import { GAME_CONFIG } from '../gameConfig'
import { createRng, deriveSeed } from '../rng'
import { isDaytime } from '../time/dayCycle'

// Quantas regiões o sorteador guarda antes de esquecer todas.
const MAX_CACHED_REGIONS = 256

const CLEAR_WEATHER = Object.freeze({ type: 'clear', intensity: 0 })

/**
 * Os tipos de clima, na ordem em que o sorteio percorre os pesos. `sun` é o
 * sol forte.
 */
export const WEATHER_TYPES = ['clear', 'sun', 'rain', 'storm', 'snow']

/** Região (coordenadas inteiras na grade de `regionSize`) do ponto `(x, z)`. */
export function weatherRegionAt(x, z, regionSize) {
  return { rx: Math.floor(x / regionSize), rz: Math.floor(z / regionSize) }
}

/** Período (inteiro) do horário `time`, em dias de jogo. */
export function weatherPeriodOf(time, period) {
  return Math.floor(time / period)
}

/** Tipo sorteado pelos `weights` do bioma (`{ clear, rain, storm, snow }`). */
export function pickWeatherType(weights, roll) {
  const total = WEATHER_TYPES.reduce(
    (sum, type) => sum + (weights[type] ?? 0),
    0,
  )
  let left = roll * total
  for (const type of WEATHER_TYPES) {
    const weight = weights[type] ?? 0
    if (weight <= 0) continue
    if (left < weight) return type
    left -= weight
  }
  // Arredondamento no fim da soma: o último tipo com peso.
  return [...WEATHER_TYPES].reverse().find((type) => (weights[type] ?? 0) > 0)
}

/**
 * Clima do mundo (docs/features/048-dia-noite-e-clima.md), headless e
 * determinístico: o mundo é dividido em regiões (`REGION_SIZE`) e o tempo
 * em períodos (`PERIOD`). Em cada região e período, um sorteio com sub-seed
 * própria escolhe o tipo pelas chances (`weather`) do bioma do centro da
 * região, e uma força entre `MIN_INTENSITY` e 1.
 *
 * O clima nunca depende de estado: com a mesma seed, posição e horário, é
 * o mesmo — no multiplayer basta a seed e o horário.
 *
 * `biomeAt(x, z)` devolve o bioma (do registro) do ponto; `params` tem a
 * forma de `GAME_CONFIG.WEATHER`.
 */
export function createWeatherSampler(
  seed,
  biomeAt,
  params = GAME_CONFIG.WEATHER,
) {
  const weatherSeed = deriveSeed(seed, 'weather')
  // O sorteio de uma região num período não muda: guarda o último de cada
  // região (quem anda por perto pergunta o tempo todo).
  const cache = new Map()

  function draw(rx, rz, period) {
    const key = `${rx}:${rz}`
    const cached = cache.get(key)
    if (cached && cached.period === period) return cached.weather

    const { REGION_SIZE, MIN_INTENSITY } = params
    const biome = biomeAt((rx + 0.5) * REGION_SIZE, (rz + 0.5) * REGION_SIZE)
    const rng = createRng(deriveSeed(weatherSeed, `${rx}:${rz}:${period}`))
    const type = pickWeatherType(biome.weather, rng())
    const intensity =
      type === 'clear' ? 0 : MIN_INTENSITY + rng() * (1 - MIN_INTENSITY)
    const weather = { type, intensity }
    // Quem viaja longe passa por muitas regiões: não guarda para sempre.
    if (cache.size >= MAX_CACHED_REGIONS) cache.clear()
    cache.set(key, { period, weather })
    return weather
  }

  return {
    /**
     * `{ type, intensity }` em `(x, z)` no horário `time`. O sol forte só
     * vale de dia: à noite, a mesma região fica limpa.
     */
    weatherAt(x, z, time) {
      const { rx, rz } = weatherRegionAt(x, z, params.REGION_SIZE)
      const weather = draw(rx, rz, weatherPeriodOf(time, params.PERIOD))
      if (weather.type === 'sun' && !isDaytime(time)) return CLEAR_WEATHER
      return weather
    },
  }
}
