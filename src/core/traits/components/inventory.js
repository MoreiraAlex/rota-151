import { trait } from 'koota'

/**
 * Itens que o treinador carrega (docs/features/041-inventario-de-itens-e-
 * pokemon.md):
 * - `counts`: quantidade por id de `core/data/items/` (`{ pokedex: 1 }`),
 *   sem limite. Item que zera sai do mapa.
 * - `positions`: em que célula da grade do Inventário cada item está
 *   (`{ pokedex: 0 }`). A grade é de posição livre: pode ter buracos. Item
 *   cuja única unidade está na mão (`HeldItem`) não ocupa célula.
 *
 * Os Pokémon fora do time NÃO ficam aqui: são registros próprios
 * (`Pokemon`), com a célula deles em `InventoryCell`. As duas coisas
 * dividem a mesma grade.
 *
 * Trait AoS (o schema é uma função, não um objeto — koota exige isso pra
 * campo que não é primitivo).
 *
 * Começa vazio; o kit inicial é posto por quem cria o treinador
 * (`core/world/world.js`).
 *
 * Dono de escrita: as actions de `core/actions/inventory.js`.
 */
export const Inventory = trait(() => ({
  counts: {},
  positions: {},
}))
