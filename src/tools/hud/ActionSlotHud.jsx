'use client'

import { useQueryFirst, useTrait } from 'koota/react'
import { playerEntity } from '@/core/world/world'
import {
  HeldItem,
  InputControlled,
  Inventory,
  SummonedCreature,
} from '@/core/traits'
import { SlotPreview } from '../shared/SlotPreview'
import { MouseLeft } from 'lucide-react'

/**
 * HUD real (não-debug) do botão de CLIQUE (esquerdo) — canto inferior
 * direito (docs/features/027-hud-de-status-e-habilidades.md, 5ª rodada).
 *
 * Só com o TREINADOR no controle: o clique é o ITEM NA MÃO (`HeldItem`/
 * `Inventory`). Com uma criatura no controle não aparece nada — ela não tem
 * ataque básico (docs/features/039-tipos-e-combate-classico.md, Parte 5), e o
 * clique só confirma o golpe aberto no indicador. Quem está no controle vem
 * de `useQueryFirst(InputControlled, SummonedCreature)` (mesma técnica
 * reativa de `SkillsHud.jsx`): resolve só quando é uma criatura.
 */
export function ActionSlotHud() {
  const controlled = useQueryFirst(InputControlled, SummonedCreature)
  const heldItem = useTrait(playerEntity, HeldItem)
  const inventory = useTrait(playerEntity, Inventory)

  if (controlled) return null

  return (
    <div className="pointer-events-none absolute bottom-4 right-4 font-mono text-xs text-white">
      <ActionSlotItem heldItem={heldItem} inventory={inventory} />
    </div>
  )
}

function ActionSlotItem({ heldItem, inventory }) {
  if (!heldItem || !inventory) return null

  const heldItemCount = heldItem.itemId
    ? inventory.itemIds.filter((id) => id === heldItem.itemId).length
    : null

  return (
    <div className="flex h-16 w-16 flex-col items-center justify-center gap-0.5 rounded border border-white/20 bg-black/70 p-1.5">
      <span className="absolute left-1 top-1 z-20 text-sm text-white">
        <MouseLeft size={16} />
      </span>
      {heldItem.itemId && (
        <SlotPreview kind="item" id={heldItem.itemId} count={heldItemCount} />
      )}
      <span className="w-full truncate text-center">
        {heldItem.itemId ?? 'vazia'}
      </span>
    </div>
  )
}
