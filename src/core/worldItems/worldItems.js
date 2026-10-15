import { getBiome } from '../data/biomes'
import { GAME_CONFIG } from '../gameConfig'
import { createRng, deriveSeed, randomInt } from '../rng'
import { chunkHeightAt, chunkKey } from '../terrain/terrainChunk'
import { dominantBiomeAt } from '../vegetation/solidModels'
import { solidParams, trunkOf } from '../vegetation/solidPlacement'
import { slopeAt } from '../vegetation/vegetationDensity'

/**
 * Itens no mundo (docs/features/055-itens-no-mundo.md) — as regras puras.
 * Quem guarda o que o jogador mexeu e cria as entidades são as actions de
 * `core/actions/worldItems.js`.
 *
 * - **No chão** (as Pokébolas): o chunk segue o `worldItems` do bioma
 *   dominante dele (`chunk.biome`) — teto, tempo de reposição e tabela.
 *   Cada vez que o chunk enche (a primeira visita e cada verificação da
 *   reposição), ele sorteia quantos quer ter: com a `chance` do bioma, de
 *   um até o teto; senão, nenhum. Se for mais do que já tem, completa; o
 *   que já está no chão fica.
 * - **Na vegetação** (as frutas): todo arbusto (`chunk.bushes`) e toda
 *   árvore (`chunk.solids.trees`) podem ser vasculhados; a cada dia de
 *   jogo, cada um sorteia pela seed se tem a fruta do bioma (`forage`) e
 *   quantas. Nada mostra qual tem.
 */

/** @typedef {{ id: string, itemId: string, x: number, y: number, z: number }} WorldItem */

// Um dia de jogo em minutos (o `refillMinutes` do bioma é em minutos de
// jogo; o relógio do mundo, em dias).
const MINUTES_PER_DAY = 24 * 60

/** As regras de itens do chunk (`worldItems` do bioma dominante) ou `null`. */
export function chunkItemRulesOf(chunk) {
  return getBiome(chunk.biome)?.worldItems ?? null
}

/** O intervalo da reposição das regras, em dias de jogo. */
export const refillIntervalDays = (rules) =>
  rules.refillMinutes / MINUTES_PER_DAY

/** Um item da tabela (`{ itemId, weight }`), sorteado pelo peso. */
export function rollItemId(table, rng) {
  const total = table.reduce((sum, { weight }) => sum + weight, 0)
  let roll = rng() * total
  for (const { itemId, weight } of table) {
    roll -= weight
    if (roll < 0) return itemId
  }
  return table[table.length - 1].itemId
}

/**
 * Um ponto livre do chunk para um item: dentro da folga da borda, fora da
 * água e de encosta íngreme, longe das pegadas dos sólidos, dos outros
 * itens (`items`) e de `avoid` (ex.: o treinador, `minDistance` m). Tenta
 * `SPOT_ATTEMPTS` pontos; sem nenhum livre, `null`.
 *
 * @returns {{ x: number, y: number, z: number } | null}
 */
export function findFreeSpot(
  chunk,
  {
    rng,
    items = [],
    avoid = null,
    minDistance = 0,
    waterLevel = GAME_CONFIG.TERRAIN.WATER_LEVEL,
    params = GAME_CONFIG.WORLD_ITEMS,
  },
) {
  const footprints = chunk.solids?.footprints ?? []
  const span = chunk.size - params.BORDER_GAP * 2
  for (let attempt = 0; attempt < params.SPOT_ATTEMPTS; attempt++) {
    const x = chunk.minX + params.BORDER_GAP + rng() * span
    const z = chunk.minZ + params.BORDER_GAP + rng() * span
    const y = chunkHeightAt(chunk, x, z)
    if (y < waterLevel + params.SHORE_GAP) continue
    if (slopeAt(chunk, x, z) > params.MAX_SLOPE) continue
    const nearSolid = footprints.some(
      (circle) =>
        Math.hypot(circle.x - x, circle.z - z) <
        circle.radius + params.SOLID_CLEARANCE,
    )
    if (nearSolid) continue
    const nearItem = items.some(
      (item) => Math.hypot(item.x - x, item.z - z) < params.ITEM_SPACING,
    )
    if (nearItem) continue
    if (avoid && Math.hypot(avoid.x - x, avoid.z - z) < minDistance) continue
    return { x, y, z }
  }
  return null
}

/**
 * Um item novo do chunk, num ponto livre, sorteado da tabela. `null` sem
 * ponto livre.
 *
 * @returns {WorldItem | null}
 */
export function rollWorldItem(chunk, rules, id, options) {
  const spot = findFreeSpot(chunk, options)
  if (!spot) return null
  return { id, itemId: rollItemId(rules.table, options.rng), ...spot }
}

/**
 * Quantos itens o chunk quer ter numa verificação: com a `chance` do bioma
 * ele quer algum, e aí de um até o teto (`maxPerChunk`); senão, nenhum.
 */
export function rollTargetCount(rules, rng) {
  if (rng() >= rules.chance) return 0
  return randomInt(rng, 1, rules.maxPerChunk)
}

/**
 * Os itens da primeira visita do chunk, pela seed: quantos
 * (`rollTargetCount`) e onde, sempre os mesmos para a mesma seed e o
 * mesmo chunk. Ids `<chave do chunk>:<índice>`.
 *
 * @returns {WorldItem[]}
 */
export function rollChunkItems(chunk, { seed, waterLevel, params } = {}) {
  const rules = chunkItemRulesOf(chunk)
  if (!rules?.table?.length) return []
  const key = chunkKey(chunk.chunkX, chunk.chunkZ)
  const rng = createRng(
    deriveSeed(seed ?? chunk.vegetationSeed, `world-items:${key}`),
  )
  const items = []
  const count = rollTargetCount(rules, rng)
  for (let index = 0; index < count; index++) {
    const item = rollWorldItem(chunk, rules, `${key}:${index}`, {
      rng,
      items,
      waterLevel,
      params,
    })
    if (item) items.push(item)
  }
  return items
}

/**
 * Quantas verificações da reposição cabem em `elapsedDays` dias de jogo:
 * uma por intervalo (`refillMinutes`).
 */
export function refillChecks(elapsedDays, rules) {
  if (!(elapsedDays > 0)) return 0
  return Math.floor(elapsedDays / refillIntervalDays(rules))
}

/**
 * Um lugar da vegetação que o F vasculha: um arbusto ou uma árvore do
 * chunk. `id` é estável (pela posição, que sai da seed); `reach` (m) é o
 * raio dele — o F alcança a partir da borda.
 *
 * @typedef {{ source: 'bush' | 'tree', id: string, x: number, y: number,
 *   z: number, reach: number, biome?: string }} ForageSpot
 */

/** O id estável de um arbusto ou árvore (`source`) em `(x, z)`. */
export const forageId = (source, { x, z }) =>
  `${source}:${x.toFixed(2)},${z.toFixed(2)}`

// Os lugares de cada chunk (o chunk não muda depois de carregado): o F
// pergunta a cada passo.
const spotsByChunk = new WeakMap()

/**
 * Os arbustos e árvores do chunk que o F vasculha (guardados por chunk).
 *
 * @returns {ForageSpot[]}
 */
export function forageSpotsOf(chunk, params = GAME_CONFIG.WORLD_ITEMS) {
  const cached = spotsByChunk.get(chunk)
  if (cached?.params === params) return cached.spots
  const spots = buildForageSpots(chunk, params)
  spotsByChunk.set(chunk, { params, spots })
  return spots
}

function buildForageSpots(chunk, params) {
  const bushes = (chunk.bushes ?? []).map((bush) => ({
    source: 'bush',
    id: forageId('bush', bush),
    x: bush.x,
    y: bush.y,
    z: bush.z,
    reach: params.BUSH_REACH,
  }))
  const solids = solidParams()
  const trees = (chunk.solids?.trees ?? []).map((tree) => ({
    source: 'tree',
    id: forageId('tree', tree),
    x: tree.x,
    y: tree.y,
    z: tree.z,
    reach: trunkOf(tree, solids).radius,
    biome: tree.biome,
  }))
  return [...bushes, ...trees]
}

/** O bioma de um lugar da vegetação (o da árvore; o do arbusto no ponto). */
export const forageBiomeOf = (chunk, spot) =>
  spot.biome ?? dominantBiomeAt(chunk, spot.x, spot.z, 'bush')

/**
 * A fruta que o bioma dá no tipo de lugar (`source`): `{ itemId, chance,
 * min, max }` (o `forage` do bioma), ou `null` se ali não dá nada.
 */
export function forageRulesOf(biomeId, source) {
  const forage = getBiome(biomeId)?.forage
  const rules = forage?.[source]
  return rules ? { itemId: forage.itemId, ...rules } : null
}

/** O dia de jogo de uma hora do mundo (o sorteio da fruta muda com ele). */
export const forageDayOf = (now) => Math.floor(now)

/**
 * Quantas frutas o lugar `id` tem no dia `day` (0 = nada), pela seed:
 * `chance` de ter e, tendo, entre `min` e `max`. O mesmo lugar e o mesmo
 * dia dão sempre o mesmo.
 */
export function rollForage(seed, id, day, rules) {
  if (!rules) return 0
  const rng = createRng(deriveSeed(seed, `forage:${id}:${day}`))
  if (rng() >= rules.chance) return 0
  return randomInt(rng, rules.min, rules.max)
}
