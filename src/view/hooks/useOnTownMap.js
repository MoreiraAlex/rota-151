'use client'

import { useTrait } from 'koota/react'
import { OnTownMap } from '@/core/traits'
import { playerEntity } from '@/core/world/world'

/**
 * Onde o treinador está no mapa de uma cidade copiada (o `OnTownMap` dele,
 * docs/features/069-revisao-do-bioma-cidade.md), ou `null` fora —
 * re-renderiza ao chegar e ao sair.
 */
export function useOnTownMap() {
  return useTrait(playerEntity, OnTownMap) ?? null
}
