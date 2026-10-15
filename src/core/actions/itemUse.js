import { CREATURE_USABLE_CATEGORIES, getItem } from '../data/items'
import { ActionState, Fainted, HeldItem, Vitals } from '../traits'
import { comecarAComer, isEating } from './eating'
import { countItem, gastarItem } from './inventory'
import { findOwnedCreature } from './owner'

/**
 * Usar um item na criatura invocada de um slot, pelo menu de ações
 * (docs/features/042-itens-da-beta.md): a criatura começa a comer a fruta
 * (`core/actions/eating.js`). Pokémon que não está invocado não recebe
 * item.
 */

/**
 * Por que o treinador não pode usar `itemId` na criatura do `slot` agora —
 * `null` quando pode. Códigos:
 * - `'no-item'` — não tem o item, ou o item não é de usar em Pokémon;
 * - `'trainer-eating'` — o treinador está comendo;
 * - `'not-summoned'` — o Pokémon do slot não está em campo;
 * - `'fainted'` — desmaiado;
 * - `'full-hp'` — vida cheia (não gasta à toa);
 * - `'eating'` — a criatura já está comendo (uma fruta por vez);
 * - `'busy'` — a criatura está no meio de outra ação.
 */
export function resolveItemUseBlock(world, trainer, slot, itemId) {
  const item = getItem(itemId)
  if (!item || !CREATURE_USABLE_CATEGORIES.includes(item.category)) {
    return 'no-item'
  }
  if (countItem(trainer, itemId) <= 0) return 'no-item'
  if (isEating(trainer)) return 'trainer-eating'

  const creature = findOwnedCreature(world, trainer, slot)
  if (!creature) return 'not-summoned'
  if (creature.has(Fainted)) return 'fainted'
  const vitals = creature.get(Vitals)
  if (!vitals || vitals.hp >= vitals.maxHp) return 'full-hp'

  if (isEating(creature)) return 'eating'
  if (creature.get(ActionState)?.current !== null) return 'busy'
  return null
}

/**
 * Usa `itemId` na criatura invocada do `slot` (ver `resolveItemUseBlock`) e
 * gasta uma unidade — se era a última e estava na mão, a mão desequipa.
 * Devolve se usou.
 */
export function usarItemNaCriatura(world, trainer, slot, itemId) {
  if (resolveItemUseBlock(world, trainer, slot, itemId)) return false
  const item = getItem(itemId)
  const creature = findOwnedCreature(world, trainer, slot)

  if (!comecarAComer(creature, item)) return false

  const left = gastarItem(trainer, itemId)
  if (!(left > 0) && trainer.get(HeldItem)?.itemId === itemId) {
    trainer.set(HeldItem, { itemId: null })
  }
  return true
}
