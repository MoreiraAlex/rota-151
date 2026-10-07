import { PLAYER_SPECIES_ID, getSpecies } from '@/core/data/species'
import { Party, resolveCreatureSpeciesId } from '@/core/traits'

// Espécie sem `vfx.eatFood`: come do chão, embaixo do `jaw`.
const DEFAULT_EAT_FOOD = { ground: 'jaw' }

/**
 * A config de onde fica a fruta enquanto `eater` come (`species.vfx.
 * eatFood`, ver `core/data/species/_template/`, docs/features/042-itens-da-
 * beta.md). O treinador é a espécie do jogador.
 */
export function resolveEatFood(eater) {
  const speciesId =
    resolveCreatureSpeciesId(eater) ??
    (eater.has(Party) ? PLAYER_SPECIES_ID : null)
  return getSpecies(speciesId)?.vfx?.eatFood ?? DEFAULT_EAT_FOOD
}

/** A fruta fica na mão (`'center'`) ou no chão (`'bottom'`)? */
export function resolveEatFoodAlign(eater) {
  return resolveEatFood(eater).hands?.length ? 'center' : 'bottom'
}
