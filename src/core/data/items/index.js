/**
 * Registro de itens. Mesma forma de `core/data/species/index.js`: eu
 * construo o mecanismo (este arquivo, `getItem`/`listItems`, `_template/`);
 * item de jogo de verdade (pokébola, poção com valores reais...) é conteúdo
 * livre pra adicionar quando quiser. `pebble`/`potion` são só pra validar o
 * mecanismo (ver docs/features/012-mecanismo-de-item.md).
 *
 * Pra adicionar um item:
 * 1) copia `_template/` pra `<id>/`
 * 2) preenche `index.js`
 * 3) importa aqui embaixo e adiciona uma linha no ITEM_REGISTRY
 */
import { PEBBLE } from './pebble'
import { POTION } from './potion'

export const ITEM_REGISTRY = {
  [PEBBLE.id]: PEBBLE,
  [POTION.id]: POTION,
}

export function getItem(id, registry = ITEM_REGISTRY) {
  return registry[id] ?? null
}

export function listItems(registry = ITEM_REGISTRY) {
  return Object.values(registry)
}
