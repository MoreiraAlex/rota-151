import {
  AMBIENT_FALLBACK_BIOME,
  BIOME_AMBIENCE,
} from '../data/audio/ambientBeds'

/**
 * Regras do som ambiente (docs/features/065-sons-do-mundo.md, Parte 4), sem
 * áudio nenhum: quanto é dia, o volume de cada fundo e quanto um som avulso
 * combina com o lugar e a hora. Quem toca é a view
 * (`view/systems/ambientBedSystem.js`).
 */

const smoothstep = (edge0, edge1, x) => {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
}

/**
 * Quanto é dia (0 = noite, 1 = dia) pela altura do sol (`sunY`, o y da
 * direção do sol): mistura os dois dentro da faixa `twilight`.
 */
export function daylightFactor(sunY, twilight) {
  return smoothstep(twilight.min, twilight.max, sunY)
}

/**
 * O volume relativo (0 a 1) de cada fundo: o peso de cada bioma em volta
 * (`weights`: `{ biomeId: peso }`, somando 1) vai pro fundo de dia dele
 * (× `daylight`) e pro de noite (× o resto). A chuva (`rain`, 0 a 1)
 * baixa o de dia em `rainDucking`. Devolve `{ bedId: nível }`.
 */
export function ambientBedLevels(
  weights,
  { daylight, rain = 0, rainDucking = 0 },
  table = BIOME_AMBIENCE,
) {
  const levels = {}
  const add = (bedId, amount) => {
    if (amount > 0) levels[bedId] = (levels[bedId] ?? 0) + amount
  }
  const ducking = 1 - rainDucking * Math.min(1, Math.max(0, rain))
  for (const [biomeId, weight] of Object.entries(weights)) {
    if (!(weight > 0)) continue
    const entry = table[biomeId] ?? table[AMBIENT_FALLBACK_BIOME]
    add(entry.day, weight * daylight * ducking)
    add(entry.night, weight * (1 - daylight))
  }
  return levels
}

/**
 * Quanto um som avulso (`AMBIENT_ONE_SHOTS`) combina com o lugar e a hora
 * (0 a 1): o peso somado dos biomas dele × o quanto é a hora dele.
 */
export function oneShotPresence(shot, weights, daylight) {
  let biomeWeight = 0
  for (const biomeId of shot.biomes) biomeWeight += weights[biomeId] ?? 0
  const timeFactor = shot.time === 'day' ? daylight : 1 - daylight
  return Math.min(1, biomeWeight) * timeFactor
}
