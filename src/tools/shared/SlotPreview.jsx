'use client'

import { getItem } from '@/core/data/items'
import { CREATURE_TINTS } from '@/view/creatureTints'
import { ITEM_COLORS } from '@/view/itemColors'

/**
 * Cor de um slot por categoria — mesma regra usada pra desenhar o
 * `SlotPreview` (abaixo) e a imagem custom de arraste (`InventoryPanel.jsx`,
 * `createDragImage`), um lugar só pra não divergir.
 */
export function getSlotColor(kind, id) {
  if (kind === 'creature') return CREATURE_TINTS[id] ?? '#999999'
  const item = getItem(id)
  return ITEM_COLORS[item?.category] ?? '#666666'
}

/**
 * Preview visual de um slot (item ou criatura) — compartilhado entre o HUD
 * sempre visível (`tools/hud/PartyHud.jsx`) e a grade de inventário
 * (`tools/menu/InventoryPanel.jsx`), pra ficarem visualmente idênticos (ver
 * docs/features/017-inventario-em-grade.md).
 *
 * Item vira um quadrado colorido por categoria + contagem da pilha
 * (`count`); criatura vira uma esfera na cor dela (`CREATURE_TINTS`, mesma
 * usada na renderização 3D) — sem contagem, criatura não empilha.
 */
export function SlotPreview({ kind, id, count }) {
  const color = getSlotColor(kind, id)

  if (kind === 'creature') {
    return (
      <span
        className="h-5 w-5 shrink-0 rounded-full"
        style={{ backgroundColor: color }}
      />
    )
  }

  return (
    <span className="relative inline-flex h-5 w-5 shrink-0">
      <span className="h-5 w-5 rounded" style={{ backgroundColor: color }} />
      {count != null && (
        <span className="absolute -right-1.5 -top-1.5 rounded bg-black/80 px-1 text-[8px] leading-tight">
          x{count}
        </span>
      )}
    </span>
  )
}
