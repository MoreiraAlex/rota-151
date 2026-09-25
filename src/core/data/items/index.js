/**
 * Registro de itens. Mesma forma de `core/data/species/index.js`: eu
 * construo o mecanismo (este arquivo, `getItem`/`listItems`, `_template/`);
 * item de jogo de verdade (pokébola, poção com valores reais...) é conteúdo
 * livre pra adicionar quando quiser. Todos os itens aqui embaixo são de
 * teste (ver docs/features/012-mecanismo-de-item.md e
 * docs/features/017-inventario-em-grade.md — mais variedade pra validar o
 * inventário em grade), não conteúdo de jogo de verdade.
 *
 * Pra adicionar um item:
 * 1) copia `_template/` pra `<id>/`
 * 2) preenche `index.js`
 * 3) importa aqui embaixo e adiciona uma linha no ITEM_REGISTRY
 */
import { PEBBLE } from './pebble'
import { ROCK } from './rock'
import { POTION } from './potion'
import { ELIXIR } from './elixir'
import { POKEDEX } from './pokedex'

export const ITEM_REGISTRY = {
  [PEBBLE.id]: PEBBLE,
  [ROCK.id]: ROCK,
  [POTION.id]: POTION,
  [ELIXIR.id]: ELIXIR,
  [POKEDEX.id]: POKEDEX,
}

export function getItem(id, registry = ITEM_REGISTRY) {
  return registry[id] ?? null
}

export function listItems(registry = ITEM_REGISTRY) {
  return Object.values(registry)
}
