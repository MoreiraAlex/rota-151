import { getItem } from '@/core/data/items'
import { ITEM_COLORS, ITEM_TINTS } from './itemColors'

/** Cor de um item no mundo: a própria (`ITEM_TINTS`) ou a da categoria. */
export function resolveItemTint(itemId) {
  return (
    ITEM_TINTS[itemId] ?? ITEM_COLORS[getItem(itemId)?.category] ?? '#999999'
  )
}
