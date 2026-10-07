'use client'

import { useState } from 'react'
import Image from 'next/image'
import { getItem, isStackableItem } from '@/core/data/items'
import { ITEM_COLORS } from '@/view/itemColors'
import { ATTACK_COLORS } from '@/view/attackColors'
import { ItemFallbackIcon } from './ItemFallbackIcon'

// Sprites que não carregaram (arquivo ainda não existe) — guardado no módulo
// pra cada célula nova não tentar de novo e piscar.
const failedSprites = new Set()

/**
 * Atributo do ícone (sem a contagem) dentro do `SlotPreview` — quem arrasta
 * (`InventoryPanel.jsx`) usa esse elemento como imagem do arraste, pra ela
 * ser igual ao que está na célula (sprite ou ícone padrão).
 */
export const DRAG_IMAGE_ATTRIBUTE = 'data-drag-image'

/**
 * Preview visual de um slot — compartilhado entre o HUD sempre visível
 * (`tools/hud/ActionSlotHud.jsx`), a grade de inventário
 * (`tools/menu/InventoryPanel.jsx`) e os menus, pra ficarem visualmente
 * idênticos (ver docs/features/017-inventario-em-grade.md).
 *
 * - `kind: 'item'` — o ícone do item (`ItemIcon`). Item que acumula
 *   (`isStackableItem`) mostra a quantidade em cima (`count`, inclusive
 *   "x1"); item que não acumula (ex.: a Pokédex), nunca.
 * - `kind: 'creature'` — o Pokémon aparece como a Pokébola em que foi
 *   capturado: `id` é o id dessa bola (`resolvePokemonBallId`), sem
 *   quantidade (docs/features/042-itens-da-beta.md).
 * - `kind: 'attack'` — skill (`SkillsHud.jsx`), um quadrado colorido por id
 *   (`ATTACK_COLORS`), sem quantidade.
 */
export function SlotPreview({ kind, id, count }) {
  if (kind === 'attack') {
    return (
      <span
        className="h-5 w-5 shrink-0 rounded"
        style={{ backgroundColor: ATTACK_COLORS[id] ?? '#999999' }}
      />
    )
  }

  const showCount =
    kind === 'item' && count != null && isStackableItem(getItem(id))

  return (
    <span className="relative inline-flex h-5 w-5 shrink-0">
      <ItemIcon itemId={id} />
      {showCount && (
        <span className="absolute -right-1.5 -top-1.5 rounded bg-black/80 px-1 text-[8px] leading-tight">
          x{count}
        </span>
      )}
    </span>
  )
}

/**
 * Ícone de um item: o `sprite.path` dele (`core/data/items/_template/
 * index.js` — mesmo mecanismo de `AttackIcon`/`SpritePortrait`,
 * `view/shared/statusDisplay.jsx`: `next/image`, escurecido um pouco por
 * cima pra contagem/badge continuar legível). Sem `sprite`, ou se a imagem
 * não carregar, o ícone padrão da categoria (`ItemFallbackIcon`).
 */
function ItemIcon({ itemId }) {
  // Só pra redesenhar quando a imagem falha (o caminho vai pra `failedSprites`).
  const [, setFailures] = useState(0)
  const item = getItem(itemId)
  const spritePath = item?.sprite?.path
  const path = spritePath && !failedSprites.has(spritePath) ? spritePath : null
  const scale = item?.sprite?.scale ?? 1
  const dragImage = { [DRAG_IMAGE_ATTRIBUTE]: '' }

  if (!path) {
    return (
      <span {...dragImage} className="inline-flex">
        <ItemFallbackIcon
          category={item?.category}
          color={ITEM_COLORS[item?.category] ?? '#666666'}
        />
      </span>
    )
  }

  return (
    <span {...dragImage} className="relative h-5 w-5 overflow-hidden rounded">
      <Image
        src={path}
        alt=""
        width={40}
        height={40}
        className="h-full w-full object-cover"
        style={{ transform: `scale(${scale})` }}
        onError={() => {
          failedSprites.add(path)
          setFailures((n) => n + 1)
        }}
      />
      <span className="absolute inset-0 bg-black/25" />
    </span>
  )
}
