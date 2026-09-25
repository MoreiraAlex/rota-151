import { getSpecies } from '@/core/data/species'
import { resolveCreatureSpeciesId } from '@/core/traits'

/**
 * Espécie de uma criatura ALVO do scanner (`Targeting`/`Scanned`, ver
 * `core/traits/components/targeting.js`) — selvagem OU do time, via
 * `resolveCreatureSpeciesId` (`core/traits/resolveCreatureSpeciesId.js`
 * — centralizada lá porque `core/actions/scanning.js` também precisa
 * da mesma resolução). `entity` pode ser `undefined` (nenhum alvo
 * agora — `useTarget` do koota devolve isso) — devolve `null`, mesmo
 * fallback gracioso de sempre.
 */
export function resolveTargetSpecies(entity) {
  const speciesId = resolveCreatureSpeciesId(entity)
  return speciesId ? getSpecies(speciesId) : null
}
