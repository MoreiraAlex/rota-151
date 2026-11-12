'use client'

import { useTrait, useWorld } from 'koota/react'
import { DoorOpen, Hand } from 'lucide-react'
import { getInterior } from '@/core/data/interiors'
import { getItem } from '@/core/data/items'
import { InteractionTarget } from '@/core/traits'
import { KeyHint } from '@/view/shared/statusDisplay'

// O que o F faz em cada tipo de alvo. Arbusto e árvore não dizem se têm
// fruta (docs/features/055-itens-no-mundo.md).
const ACTION_TEXT = {
  bush: 'Vasculhar o arbusto',
  tree: 'Vasculhar a árvore',
}

// Entrar e sair dos prédios (docs/features/068-interior-dos-predios.md):
// o ícone da porta no lugar da mão.
const DOOR_KINDS = new Set(['door', 'exit'])

/**
 * Aviso de "F — pegar / vasculhar" (docs/features/055-itens-no-mundo.md): o
 * alvo que o `interactionSystem` guardou (`InteractionTarget`, trait do
 * mundo), no centro de baixo da tela. Some quando nada está ao alcance.
 * Perto da porta de um prédio, "Entrar no …"; dentro, no tapete da
 * entrada, "Sair do …" (docs/features/068-interior-dos-predios.md).
 */
export function InteractionHud() {
  const world = useWorld()
  const target = useTrait(world, InteractionTarget)
  const text = resolveText(target)
  if (!text) return null

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-36 flex justify-center">
      <div className="flex items-center gap-2 rounded-md bg-black/55 px-3 py-1.5 text-sm text-white shadow">
        <KeyHint
          keyLabel="F"
          icon={DOOR_KINDS.has(target.kind) ? DoorOpen : Hand}
        />
        <span>{text}</span>
      </div>
    </div>
  )
}

function resolveText(target) {
  if (!target?.kind) return null
  if (DOOR_KINDS.has(target.kind)) {
    const interior = getInterior(target.itemId)
    return target.kind === 'door' ? interior?.enterText : interior?.exitText
  }
  if (target.kind === 'item') {
    return `Pegar ${getItem(target.itemId)?.name ?? target.itemId}`
  }
  return ACTION_TEXT[target.kind] ?? null
}
