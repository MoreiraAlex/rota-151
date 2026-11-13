import { GAME_CONFIG } from '../gameConfig'
import { createRng, deriveSeed, randomInt } from '../rng'
import { resolveLevelCap } from '../data/species/experience'

/**
 * O nível das selvagens pelas cidades (docs/features/062-spawn-estilo-
 * cobblemon.md). A primeira cidade (a da origem, onde o treinador nasce) é
 * a mais fraca, com o nível fixo do começo.
 *
 * - **Só a cidade inicial** (`CITIES.ONLY_FIRST`, docs/features/069-
 *   revisao-do-bioma-cidade.md — nesta beta): da borda dela para fora o
 *   nível sobe aos poucos com a distância, até o teto da versão
 *   (`CAP_DISTANCE`).
 * - **Com as cidades procedurais**: cada uma das outras sorteia o seu pela
 *   seed, entre o do começo e o teto — não cresce com a distância da
 *   origem. Perto de uma cidade, a selvagem fica perto do nível dela; no
 *   caminho até a outra, o nível vai mudando aos poucos até o dela.
 *
 * Cada indivíduo varia um pouco em volta disso. Puro: quem chama passa as
 * cidades mais próximas (`nearestCities` do relevo) e a seed.
 */

const isFirstCity = (city) => city.cellX === 0 && city.cellZ === 0

/**
 * O nível da `city`, pela seed, entre o da primeira cidade e o teto (a
 * primeira, o fixo do começo — nenhuma fica abaixo dela).
 */
export function cityLevel(seed, city, params = levelParams()) {
  if (isFirstCity(city)) return params.FIRST_CITY
  const rng = createRng(deriveSeed(seed, `city-level:${city.id}`))
  return randomInt(rng, params.FIRST_CITY, params.CAP)
}

/**
 * O nível base num ponto, das duas cidades mais próximas (`nearest`, em
 * ordem de distância): cada uma pesa pela proximidade — no centro de uma,
 * o dela; a meio caminho, a média das duas. Só a cidade inicial: pela
 * distância dela (`levelFromStart`). Uma só (outra), o dela; sem nenhuma,
 * o do começo.
 */
export function baseLevelAt(seed, nearest, params = levelParams()) {
  const [first, second] = nearest
  if (!first) return params.FIRST_CITY
  if (!second && isFirstCity(first.city)) return levelFromStart(first, params)
  const firstLevel = cityLevel(seed, first.city, params)
  if (!second) return firstLevel
  const total = first.distance + second.distance
  if (total <= 0) return firstLevel
  const secondLevel = cityLevel(seed, second.city, params)
  const firstWeight = second.distance / total
  return firstLevel * firstWeight + secondLevel * (1 - firstWeight)
}

/**
 * O nível base a `distance` m do centro da cidade inicial (`city`): o do
 * começo até a borda dela (`radius`), e de lá sobe em linha reta até o teto
 * a `CAP_DISTANCE` m da borda; além, o teto.
 */
export function levelFromStart({ city, distance }, params = levelParams()) {
  const reach = params.CAP_DISTANCE
  const outside = Math.max(0, distance - (city.radius ?? 0))
  const t = reach > 0 ? Math.min(outside / reach, 1) : 1
  return params.FIRST_CITY + (params.CAP - params.FIRST_CITY) * t
}

/**
 * O nível de uma selvagem com o nível base `base`: arredondado, mais a
 * variação do indivíduo (`SPREAD` para cada lado), dentro de 1 e do teto
 * da versão.
 */
export function rollLevelAround(rng, base, params = levelParams()) {
  const level = Math.round(base) + randomInt(rng, -params.SPREAD, params.SPREAD)
  return Math.min(params.CAP, Math.max(1, level))
}

/** Os parâmetros do nível: `WILD_SPAWN.LEVEL` + o teto da versão (`CAP`). */
export function levelParams() {
  return { ...GAME_CONFIG.WILD_SPAWN.LEVEL, CAP: resolveLevelCap() }
}
