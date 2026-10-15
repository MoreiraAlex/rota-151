import {
  berriesHarvested,
  foragedNothing,
  inventoryFull,
  worldItemPicked,
} from '../events'
import { GAME_CONFIG } from '../gameConfig'
import { gameplayRng } from '../rng'
import { chunkKey } from '../terrain/terrainChunk'
import {
  GroundItem,
  Position,
  WorldItemChunks,
  WorldItemsMemory,
} from '../traits'
import {
  chunkItemRulesOf,
  forageBiomeOf,
  forageDayOf,
  forageRulesOf,
  refillChecks,
  refillIntervalDays,
  rollChunkItems,
  rollForage,
  rollTargetCount,
  rollWorldItem,
} from '../worldItems/worldItems'
import { adicionarItem, cabeNoInventario } from './inventory'

/**
 * Itens no mundo (docs/features/055-itens-no-mundo.md): a memória do que o
 * jogador mexeu (`WorldItemsMemory`, a fonte), as entidades dos itens do
 * chão que saem dela e da seed, nascendo e morrendo com o chunk
 * (`GroundItem`), e vasculhar arbustos e árvores atrás de fruta.
 *
 * A memória é mutada no lugar (objetos dentro do trait AoS): ninguém
 * assina ela, só o save lê.
 */

const keyOf = (chunk) => chunkKey(chunk.chunkX, chunk.chunkZ)
const memoryOf = (world) => world.get(WorldItemsMemory)

/** Os itens no chão do chunk agora: os da memória, ou os da seed. */
export function itensDoChunk(world, chunk) {
  return memoryOf(world).chunks[keyOf(chunk)]?.items ?? rollChunkItems(chunk)
}

/**
 * Uma verificação da reposição do chunk: conta um intervalo e sorteia
 * quantos itens ele quer ter (`rollTargetCount`, de nenhum até o teto); se
 * for mais do que já tem, completa em pontos livres longe de `avoid`. O que
 * já está no chão fica. Chunk que ninguém mexeu entra na memória só se
 * ganhar item. Devolve os itens novos (quem chama cria as entidades, se o
 * chunk já está em entidade).
 */
export function verificarTetoDoChunk(
  world,
  chunk,
  { avoid = null, rng = gameplayRng } = {},
) {
  const rules = chunkItemRulesOf(chunk)
  if (!rules?.table?.length) return []
  const key = keyOf(chunk)
  const interval = refillIntervalDays(rules)
  const { checkedAt } = world.get(WorldItemChunks)
  const known = memoryOf(world).chunks[key]
  const checkedOn =
    (known ? known.lastRefill : (checkedAt.get(key) ?? 0)) + interval
  if (known) known.lastRefill = checkedOn
  else checkedAt.set(key, checkedOn)

  const current = known ? known.items.length : groundItemsOf(world, key).length
  const missing = rollTargetCount(rules, rng) - current
  if (missing <= 0) return []

  const entry = ensureChunkEntry(world, key, checkedOn)
  const added = []
  for (let i = 0; i < missing; i++) {
    const item = rollWorldItem(chunk, rules, `${key}:r${entry.nextIndex}`, {
      rng,
      items: entry.items,
      avoid,
      minDistance: GAME_CONFIG.WORLD_ITEMS.SPAWN_MIN_DISTANCE,
    })
    if (!item) break
    entry.items.push(item)
    entry.nextIndex += 1
    added.push(item)
  }
  return added
}

/**
 * Na volta a um chunk da memória: as verificações da reposição que caberiam
 * no tempo em que ele ficou fora (`refillChecks`), parando quando enche.
 * Devolve os itens novos.
 */
export function reporTempoFora(world, chunk, { now, avoid, rng } = {}) {
  const entry = memoryOf(world).chunks[keyOf(chunk)]
  const rules = chunkItemRulesOf(chunk)
  if (!entry || !rules) return []
  const checks = refillChecks(now - entry.lastRefill, rules)
  const added = []
  for (let i = 0; i < checks; i++) {
    if (entry.items.length >= rules.maxPerChunk) {
      // Cheio: as verificações que sobraram não mudariam nada.
      entry.lastRefill = now
      break
    }
    added.push(...verificarTetoDoChunk(world, chunk, { avoid, rng }))
  }
  return added
}

/** O item `item` da memória do chunk `key` vira entidade no chão. */
export function criarItemNoChao(world, key, item) {
  return world.spawn(
    GroundItem({ worldId: item.id, itemId: item.itemId, chunkKey: key }),
    Position({ x: item.x, y: item.y, z: item.z }),
  )
}

/**
 * O teto vale também para o que está salvo: se o `maxPerChunk` do bioma
 * baixou (ajuste da config), o que passa dele na memória do chunk sai — os
 * primeiros ficam.
 */
export function aplicarTetoDaMemoria(world, chunk) {
  const entry = memoryOf(world).chunks[keyOf(chunk)]
  const rules = chunkItemRulesOf(chunk)
  if (!entry || !rules) return
  if (entry.items.length > rules.maxPerChunk) {
    entry.items = entry.items.slice(0, rules.maxPerChunk)
  }
}

/**
 * O chunk carregou: corta o que passa do teto (`aplicarTetoDaMemoria`),
 * repõe o tempo fora e cria as entidades dos itens do chão dele. Já
 * criadas, nada.
 */
export function carregarItensDoChunk(world, chunk, { now, avoid } = {}) {
  const key = keyOf(chunk)
  const { loaded } = world.get(WorldItemChunks)
  if (loaded.has(key)) return
  aplicarTetoDaMemoria(world, chunk)
  reporTempoFora(world, chunk, { now, avoid })
  for (const item of itensDoChunk(world, chunk)) {
    criarItemNoChao(world, key, item)
  }
  loaded.set(key, chunk)
  world.get(WorldItemChunks).checkedAt.set(key, now ?? 0)
}

// As entidades dos itens do chão do chunk `key`.
const groundItemsOf = (world, key) =>
  world
    .query(GroundItem, Position)
    .filter((entity) => entity.get(GroundItem).chunkKey === key)

/** O chunk descarregou: as entidades dele saem (a memória fica). */
export function descarregarItensDoChunk(world, key) {
  const gone = groundItemsOf(world, key)
  // Fora da iteração: destruir no meio da query mexe nela.
  for (const entity of gone) entity.destroy()
  const { loaded, checkedAt } = world.get(WorldItemChunks)
  loaded.delete(key)
  checkedAt.delete(key)
}

/**
 * A entrada do chunk na memória, criada na primeira mexida a partir dos
 * itens que estão no chão (as entidades dele).
 */
function ensureChunkEntry(world, key, now) {
  const memory = memoryOf(world)
  if (!memory.chunks[key]) {
    const items = groundItemsOf(world, key).map((entity) => {
      const ground = entity.get(GroundItem)
      const { x, y, z } = entity.get(Position)
      return { id: ground.worldId, itemId: ground.itemId, x, y, z }
    })
    memory.chunks[key] = { items, lastRefill: now, nextIndex: 0 }
  }
  return memory.chunks[key]
}

/**
 * O treinador pega o item do chão `entity`: soma no inventário, sai da
 * memória e do mundo. Não cabendo, não pega e avisa. Se o chunk estava no
 * teto (`maxPerChunk` do `chunk`), a reposição começa a contar agora.
 * Devolve se pegou.
 */
export function pegarItemDoMundo(
  world,
  trainer,
  entity,
  { chunk, now, events },
) {
  const ground = entity.get(GroundItem)
  if (!cabeNoInventario(world, trainer, ground.itemId)) {
    events?.emit(inventoryFull({ itemId: ground.itemId }))
    return false
  }
  const entry = ensureChunkEntry(world, ground.chunkKey, now)
  const rules = chunk ? chunkItemRulesOf(chunk) : null
  if (rules && entry.items.length >= rules.maxPerChunk) entry.lastRefill = now
  entry.items = entry.items.filter((item) => item.id !== ground.worldId)

  adicionarItem(world, trainer, ground.itemId, 1)
  const { x, y, z } = entity.get(Position)
  events?.emit(
    worldItemPicked({
      itemId: ground.itemId,
      amount: 1,
      position: { x, y, z },
    }),
  )
  entity.destroy()
  return true
}

/**
 * O treinador vasculha o arbusto ou a árvore `spot` (`ForageSpot`, do
 * `chunk`): se o sorteio do dia deu fruta e ninguém colheu hoje, as frutas
 * vão para o inventário e o lugar fica vazio até o dia seguinte. Sem fruta,
 * avisa que não achou nada; não cabendo, não colhe e avisa. Devolve
 * quantas colheu.
 */
export function vasculhar(world, trainer, spot, { chunk, now, events }) {
  const position = { x: spot.x, y: spot.y, z: spot.z }
  const day = forageDayOf(now)
  const { foraged } = memoryOf(world)
  const rules = chunk
    ? forageRulesOf(forageBiomeOf(chunk, spot), spot.source)
    : null
  const amount =
    foraged[spot.id] === day
      ? 0
      : rollForage(chunk?.vegetationSeed ?? 0, spot.id, day, rules)
  if (amount <= 0) {
    events?.emit(foragedNothing({ source: spot.source, position }))
    return 0
  }
  if (!cabeNoInventario(world, trainer, rules.itemId)) {
    events?.emit(inventoryFull({ itemId: rules.itemId }))
    return 0
  }
  adicionarItem(world, trainer, rules.itemId, amount)
  forgetOldForaging(foraged, day)
  foraged[spot.id] = day
  events?.emit(
    berriesHarvested({
      itemId: rules.itemId,
      amount,
      source: spot.source,
      position,
    }),
  )
  return amount
}

// Só o dia de hoje importa: o que foi colhido antes sorteia de novo.
function forgetOldForaging(foraged, day) {
  for (const [id, harvestedOn] of Object.entries(foraged)) {
    if (harvestedOn < day) delete foraged[id]
  }
}

/** A memória toda volta a vazia (novo jogo; testes). */
export function esquecerItensDoMundo(world) {
  world.set(WorldItemsMemory, { chunks: {}, foraged: {} })
}
