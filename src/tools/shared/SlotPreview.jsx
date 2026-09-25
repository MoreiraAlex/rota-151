'use client'

import Image from 'next/image'
import { getItem } from '@/core/data/items'
import { CREATURE_TINTS } from '@/view/creatureTints'
import { ITEM_COLORS } from '@/view/itemColors'
import { ATTACK_COLORS } from '@/view/attackColors'

/**
 * Cor de um slot por categoria — mesma regra usada pra desenhar o
 * `SlotPreview` (abaixo) e a imagem custom de arraste (`InventoryPanel.jsx`,
 * `createDragImage`), um lugar só pra não divergir. `'attack'` (skill,
 * `tools/hud/SkillsHud.jsx`) é o terceiro kind, ao lado de `'item'`/
 * `'creature'`.
 */
export function getSlotColor(kind, id) {
  if (kind === 'creature') return CREATURE_TINTS[id] ?? '#999999'
  if (kind === 'attack') return ATTACK_COLORS[id] ?? '#999999'
  const item = getItem(id)
  return ITEM_COLORS[item?.category] ?? '#666666'
}

/**
 * Preview visual de um slot (item ou criatura) — compartilhado entre o HUD
 * sempre visível (`tools/hud/PartyHud.jsx`) e a grade de inventário
 * (`tools/menu/InventoryPanel.jsx`), pra ficarem visualmente idênticos (ver
 * docs/features/017-inventario-em-grade.md).
 *
 * Item com `sprite.path` configurado (`core/data/items/_template/index.js`
 * — pedido do usuário: "quero a possibilidade de colocar img nos ícones
 * do inventário/hud", ver docs/features/031-*.md) mostra a imagem de
 * verdade, mesmo mecanismo de `AttackIcon`/`SpritePortrait`
 * (`view/shared/statusDisplay.jsx`: `next/image`, escurecido um pouco
 * por cima pra qualquer contagem/badge continuar legível). Sem
 * `sprite`, cai no quadrado colorido por categoria de sempre
 * (`ITEM_COLORS`). Criatura vira uma esfera na cor dela
 * (`CREATURE_TINTS`, mesma usada na renderização 3D) — sem contagem,
 * criatura não empilha; sem sprite próprio aqui (retrato de verdade já
 * é o `SpritePortrait`, usado noutros HUDs). Ataque/skill
 * (`SkillsHud.jsx`) vira um quadrado colorido por id (`ATTACK_COLORS`)
 * — mesma forma do item, mas sem contagem (skill não empilha).
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

  if (kind === 'attack') {
    return (
      <span
        className="h-5 w-5 shrink-0 rounded"
        style={{ backgroundColor: color }}
      />
    )
  }

  const item = getItem(id)
  const path = item?.sprite?.path
  const scale = item?.sprite?.scale ?? 1

  return (
    <span className="relative inline-flex h-5 w-5 shrink-0">
      {path ? (
        <span className="relative h-5 w-5 overflow-hidden rounded">
          <Image
            src={path}
            alt=""
            width={40}
            height={40}
            className="h-full w-full object-cover"
            style={{ transform: `scale(${scale})` }}
          />
          <span className="absolute inset-0 bg-black/25" />
        </span>
      ) : (
        <span className="h-5 w-5 rounded" style={{ backgroundColor: color }} />
      )}
      {count != null && (
        <span className="absolute -right-1.5 -top-1.5 rounded bg-black/80 px-1 text-[8px] leading-tight">
          x{count}
        </span>
      )}
    </span>
  )
}
