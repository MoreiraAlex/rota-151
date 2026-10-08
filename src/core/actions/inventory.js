import { ITEM_CATEGORY_ORDER, getItem } from '../data/items'
import { getSpecies } from '../data/species'
import { GAME_CONFIG } from '../gameConfig'
import {
  CreatureLevel,
  HeldItem,
  Inventory,
  InventoryCell,
  OwnedBy,
  Pokemon,
} from '../traits'

/**
 * Inventário do treinador (docs/features/041-inventario-de-itens-e-
 * pokemon.md): itens com quantidade, sem limite, numa grade de posição
 * livre dividida com os Pokémon fora do time. Toda mutação de `Inventory`
 * passa por aqui.
 *
 * Cada coisa na grade é uma "entrada":
 * - `{ kind: 'item', id }` — célula em `Inventory.positions[id]`;
 * - `{ kind: 'creature', pokemon }` — célula no `InventoryCell` do registro.
 *
 * Item cuja única unidade está na mão não ocupa célula (`syncItemCells`).
 */

/** Quantas unidades de `itemId` o `trainer` tem (contando a da mão). */
export function countItem(trainer, itemId) {
  return trainer?.get?.(Inventory)?.counts?.[itemId] ?? 0
}

/** Quantas unidades de `itemId` aparecem na grade (sem a da mão). */
export function countVisibleItem(trainer, itemId) {
  const held = trainer?.get?.(HeldItem)?.itemId === itemId ? 1 : 0
  return countItem(trainer, itemId) - held
}

/** Os Pokémon do `trainer` que estão no inventário (têm célula). */
function listCellPokemon(world, trainer) {
  if (!world || !trainer) return []
  return world
    .query(Pokemon, InventoryCell, OwnedBy(trainer))
    .filter((pokemon) => pokemon.isAlive())
}

/**
 * Células ocupadas da grade do `trainer`: `Map` de índice → entrada (ver
 * docstring do módulo). Itens só entram com unidade visível.
 */
export function resolveInventoryCells(world, trainer) {
  const cells = new Map()
  const { positions } = trainer.get(Inventory)
  for (const [id, index] of Object.entries(positions)) {
    if (countVisibleItem(trainer, id) > 0) {
      cells.set(index, { kind: 'item', id })
    }
  }
  for (const pokemon of listCellPokemon(world, trainer)) {
    cells.set(pokemon.get(InventoryCell).index, { kind: 'creature', pokemon })
  }
  return cells
}

/**
 * A menor célula livre da grade. `itemPositions` permite contar posições de
 * item ainda não gravadas (dentro de uma mutação em andamento).
 */
export function findFreeCell(world, trainer, itemPositions = null) {
  const taken = new Set(
    Object.values(itemPositions ?? trainer.get(Inventory).positions),
  )
  for (const pokemon of listCellPokemon(world, trainer)) {
    taken.add(pokemon.get(InventoryCell).index)
  }
  let index = 0
  while (taken.has(index)) index++
  return index
}

/**
 * Quantas células a grade do inventário tem — o tamanho visual dela
 * (`GAME_CONFIG.INVENTORY`, colunas × linhas). É o limite do inventário.
 */
export function resolveInventoryCapacity() {
  const { COLUMNS, ROWS } = GAME_CONFIG.INVENTORY
  return COLUMNS * ROWS
}

/** Se ainda cabe mais uma coisa na grade do `trainer`. */
export function hasFreeCell(world, trainer) {
  return findFreeCell(world, trainer) < resolveInventoryCapacity()
}

/**
 * Põe as posições dos itens em dia: item sem unidade visível larga a célula;
 * com `world`, item visível sem célula ganha a primeira livre (sem `world`,
 * só larga — quem só gasta não precisa achar célula).
 */
function syncItemCells(world, trainer) {
  const inventory = trainer.get(Inventory)
  const positions = { ...inventory.positions }
  for (const id of Object.keys(positions)) {
    if (countVisibleItem(trainer, id) <= 0) delete positions[id]
  }
  if (world) {
    for (const id of Object.keys(inventory.counts)) {
      if (positions[id] != null || countVisibleItem(trainer, id) <= 0) continue
      positions[id] = findFreeCell(world, trainer, positions)
    }
  }
  trainer.set(Inventory, { ...inventory, positions })
}

/** Soma `amount` unidades de `itemId` (padrão: uma). Item novo ganha célula. */
export function adicionarItem(world, trainer, itemId, amount = 1) {
  if (!trainer?.has?.(Inventory) || !itemId || !(amount > 0)) return
  const inventory = trainer.get(Inventory)
  const { counts } = inventory
  trainer.set(Inventory, {
    ...inventory,
    counts: { ...counts, [itemId]: (counts[itemId] ?? 0) + amount },
  })
  syncItemCells(world, trainer)
}

/**
 * Gasta uma unidade de `itemId`; zerou, o item sai do mapa (e da grade).
 * Devolve quantas sobraram, ou `null` se não tinha nenhuma.
 */
export function gastarItem(trainer, itemId) {
  const current = countItem(trainer, itemId)
  if (current <= 0) return null
  const inventory = trainer.get(Inventory)
  const counts = { ...inventory.counts }
  if (current === 1) delete counts[itemId]
  else counts[itemId] = current - 1
  trainer.set(Inventory, { ...inventory, counts })
  syncItemCells(null, trainer)
  return current - 1
}

/**
 * Põe `itemId` na mão (precisa ter uma unidade). O que estava na mão volta
 * pra grade. Devolve se equipou.
 */
export function equiparNaMao(world, trainer, itemId) {
  if (countItem(trainer, itemId) <= 0) return false
  trainer.set(HeldItem, { itemId })
  syncItemCells(world, trainer)
  return true
}

/**
 * Esvazia a mão; o item volta pra grade — na célula `index`, se livre, ou
 * na primeira livre.
 */
export function desequiparMao(world, trainer, index = null) {
  const itemId = trainer.get(HeldItem)?.itemId
  if (!itemId) return
  trainer.set(HeldItem, { itemId: null })
  const inventory = trainer.get(Inventory)
  const positions = { ...inventory.positions }
  const placed =
    positions[itemId] == null &&
    index != null &&
    !resolveInventoryCells(world, trainer).has(index)
  if (placed) {
    positions[itemId] = index
    trainer.set(Inventory, { ...inventory, positions })
  }
  syncItemCells(world, trainer)
}

/** Em que célula está a entrada, ou `null`. */
export function resolveEntryCell(trainer, entry) {
  if (entry?.kind === 'item') {
    return trainer.get(Inventory).positions[entry.id] ?? null
  }
  if (entry?.kind === 'creature' && entry.pokemon?.has?.(InventoryCell)) {
    return entry.pokemon.get(InventoryCell).index
  }
  return null
}

function writeEntryCell(trainer, entry, index) {
  if (entry.kind === 'item') {
    const inventory = trainer.get(Inventory)
    trainer.set(Inventory, {
      ...inventory,
      positions: { ...inventory.positions, [entry.id]: index },
    })
    return
  }
  entry.pokemon.set(InventoryCell, { index })
}

/**
 * Move uma entrada da grade pra célula `toIndex`. Se lá tem outra, as duas
 * trocam de lugar. Devolve se mudou.
 */
export function moverNoInventario(world, trainer, entry, toIndex) {
  const fromIndex = resolveEntryCell(trainer, entry)
  if (fromIndex == null || fromIndex === toIndex || !(toIndex >= 0)) {
    return false
  }
  // Fora da grade, não (o limite do inventário).
  if (toIndex >= resolveInventoryCapacity()) return false
  const occupant = resolveInventoryCells(world, trainer).get(toIndex)
  writeEntryCell(trainer, entry, toIndex)
  if (occupant) writeEntryCell(trainer, occupant, fromIndex)
  return true
}

/**
 * Organiza a grade sem buracos: primeiro os itens (por categoria, na ordem
 * de `ITEM_CATEGORY_ORDER`, e nome), depois os Pokémon (por número da
 * Pokédex e, na mesma espécie, do maior nível pro menor).
 */
export function organizarInventario(world, trainer) {
  const entries = [...resolveInventoryCells(world, trainer).values()]
  const items = entries
    .filter((entry) => entry.kind === 'item')
    .sort(compareItems)
  const pokemon = entries
    .filter((entry) => entry.kind === 'creature')
    .sort(comparePokemon)
  ;[...items, ...pokemon].forEach((entry, index) =>
    writeEntryCell(trainer, entry, index),
  )
}

function categoryRank(item) {
  const rank = ITEM_CATEGORY_ORDER.indexOf(item?.category)
  return rank === -1 ? ITEM_CATEGORY_ORDER.length : rank
}

function compareItems(a, b) {
  const itemA = getItem(a.id)
  const itemB = getItem(b.id)
  return (
    categoryRank(itemA) - categoryRank(itemB) ||
    (itemA?.name ?? a.id).localeCompare(itemB?.name ?? b.id)
  )
}

function comparePokemon(a, b) {
  const speciesA = getSpecies(a.pokemon.get(Pokemon).speciesId)
  const speciesB = getSpecies(b.pokemon.get(Pokemon).speciesId)
  const dex = (speciesA?.dexNumber ?? 0) - (speciesB?.dexNumber ?? 0)
  if (dex !== 0) return dex
  return (
    (b.pokemon.get(CreatureLevel)?.level ?? 0) -
    (a.pokemon.get(CreatureLevel)?.level ?? 0)
  )
}
