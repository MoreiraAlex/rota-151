/**
 * Registro de itens. Mesma forma de `core/data/species/index.js`: o
 * mecanismo (este arquivo, `getItem`/`listItems`, `_template/`) e os itens
 * da beta (docs/features/042-itens-da-beta.md) — Pokébolas, poções, frutas
 * e a Pokédex.
 *
 * Pra adicionar um item:
 * 1) copia `_template/` pra `<id>/`
 * 2) preenche `index.js`
 * 3) importa aqui embaixo e adiciona uma linha no ITEM_REGISTRY
 */
import { POKEDEX } from './pokedex'
import { POKE_BALL } from './poke-ball'
import { GREAT_BALL } from './great-ball'
import { ULTRA_BALL } from './ultra-ball'
import { POTION } from './potion'
import { SUPER_POTION } from './super-potion'
import { HYPER_POTION } from './hyper-potion'
import { RAZZ_BERRY } from './razz-berry'
import { NANAB_BERRY } from './nanab-berry'
import { PINAP_BERRY } from './pinap-berry'

export const ITEM_REGISTRY = {
  [POKEDEX.id]: POKEDEX,
  [POKE_BALL.id]: POKE_BALL,
  [GREAT_BALL.id]: GREAT_BALL,
  [ULTRA_BALL.id]: ULTRA_BALL,
  [POTION.id]: POTION,
  [SUPER_POTION.id]: SUPER_POTION,
  [HYPER_POTION.id]: HYPER_POTION,
  [RAZZ_BERRY.id]: RAZZ_BERRY,
  [NANAB_BERRY.id]: NANAB_BERRY,
  [PINAP_BERRY.id]: PINAP_BERRY,
}

/**
 * Ordem das categorias quando o Inventário é organizado (botão
 * "Organizar", `organizarInventario`). Categoria fora da lista vai pro fim.
 */
export const ITEM_CATEGORY_ORDER = [
  'scanner',
  'pokeball',
  'consumable',
  'berry',
]

/**
 * Categorias que o treinador pode usar NUM Pokémon (menu de ações,
 * `usarItemNaCriatura`) — poção cura na hora, fruta a criatura come.
 */
export const CREATURE_USABLE_CATEGORIES = ['consumable', 'berry']

/**
 * Pokébola de quem não foi capturado com outra — os Pokémon iniciais (ver
 * `Pokemon.ballId`, `core/traits/components/pokemon.js`).
 */
export const DEFAULT_POKEBALL_ID = POKE_BALL.id

/**
 * O item acumula (mostra a quantidade, ex.: "x3")? `stackable: false` no
 * dado do item diz que não (ex.: a Pokédex); sem o campo, acumula.
 */
export function isStackableItem(item) {
  return item?.stackable ?? true
}

export function getItem(id, registry = ITEM_REGISTRY) {
  return registry[id] ?? null
}

export function listItems(registry = ITEM_REGISTRY) {
  return Object.values(registry)
}

/**
 * O mapa de clipes do `.glb` do item por momento da captura
 * (`model.animations`), ou o do item de onde ele herda os clipes
 * (`model.clipsFrom`, docs/features/043-captura.md). `null` sem nenhum.
 */
export function resolveItemAnimations(item, registry = ITEM_REGISTRY) {
  const model = item?.model
  if (!model) return null
  if (model.animations) return model.animations
  if (!model.clipsFrom) return null
  return getItem(model.clipsFrom, registry)?.model?.animations ?? null
}
