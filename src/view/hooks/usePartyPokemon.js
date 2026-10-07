'use client'

import { useQuery, useTarget } from 'koota/react'
import { OwnedBy, PartySlots, Pokemon } from '@/core/traits'

/**
 * O Pokémon (registro, `Pokemon`) de cada slot do time do `trainer`, ao
 * vivo: `{ slot1, slot2, slot3 }`, cada um a entidade ou `null`. Acompanha
 * as relações `PartySlots` (docs/features/041-inventario-de-itens-e-
 * pokemon.md) — trocar, tirar ou reordenar re-renderiza.
 */
export function usePartyPokemon(trainer) {
  const slot1 = useTarget(trainer, PartySlots.slot1)
  const slot2 = useTarget(trainer, PartySlots.slot2)
  const slot3 = useTarget(trainer, PartySlots.slot3)
  return { slot1: slot1 ?? null, slot2: slot2 ?? null, slot3: slot3 ?? null }
}

/** Todos os Pokémon do `trainer` (time e inventário), ao vivo. */
export function useOwnedPokemon(trainer) {
  return useQuery(Pokemon, OwnedBy(trainer))
}
