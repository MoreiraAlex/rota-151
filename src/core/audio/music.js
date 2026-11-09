import {
  BIOME_MUSIC,
  DEFAULT_MUSIC_FREQUENCY,
  MUSIC_FALLBACK_BIOME,
  MUSIC_FREQUENCIES,
} from '../data/audio/musicTracks'

/**
 * Regras da música de fundo (docs/features/065-sons-do-mundo.md, Parte 2),
 * sem áudio nenhum: que músicas podem tocar, qual é a próxima e quanto dura
 * o silêncio. Quem toca é a view (`view/systems/musicSystem.js`). O sorteio
 * recebe a função de aleatório de quem chama (música é cosmética).
 */

/** As músicas que podem tocar no bioma `biomeId` na hora (`isDay`). */
export function musicPool(biomeId, isDay, table = BIOME_MUSIC) {
  const entry = table[biomeId] ?? table[MUSIC_FALLBACK_BIOME]
  return isDay ? entry.day : entry.night
}

/**
 * Sorteia a próxima música de `pool`, sem repetir a última (`lastId`) se
 * houver outra. `random` devolve um número em [0, 1).
 */
export function pickTrack(pool, lastId, random) {
  const options = pool.length > 1 ? pool.filter((id) => id !== lastId) : pool
  if (options.length === 0) return null
  return options[
    Math.min(options.length - 1, Math.floor(random() * options.length))
  ]
}

/** Um tempo sorteado entre `range.min` e `range.max` (s). */
export function randomBetween(range, random) {
  return range.min + random() * (range.max - range.min)
}

/** O silêncio (s) até a próxima música na frequência `frequency`. */
export function silenceDuration(frequency, random, table = MUSIC_FREQUENCIES) {
  return randomBetween(
    table[frequency] ?? table[DEFAULT_MUSIC_FREQUENCY],
    random,
  )
}
