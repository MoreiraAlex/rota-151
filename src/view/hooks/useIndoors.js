'use client'

import { useTrait } from 'koota/react'
import { Indoors } from '@/core/traits'
import { playerEntity } from '@/core/world/world'

/**
 * Onde o treinador está dentro de um prédio (o `Indoors` dele,
 * docs/features/068-interior-dos-predios.md), ou `null` do lado de fora —
 * re-renderiza ao entrar e ao sair.
 */
export function useIndoors() {
  return useTrait(playerEntity, Indoors) ?? null
}
