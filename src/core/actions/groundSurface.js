import { TEST_LEVEL } from '../data/testLevel'
import { groundSurfaceAt } from '../terrain/groundSurface'
import { activeTownMapAt } from '../townMap/activeTownMap'
import { townMapSurfaceAt } from '../townMap/townMapPlacement'

/**
 * O chão em `(x, z)` do mundo para o som do passo (`'grass'` ou
 * `'ground'`, `core/terrain/groundSurface.js`) — com o relevo de
 * `TEST_LEVEL`, ou o do mapa de cidade em que o treinador está
 * (docs/features/069-revisao-do-bioma-cidade.md, Pallet).
 */
export function levelGroundSurfaceAt(x, z) {
  const townMap = activeTownMapAt(x, z)
  if (townMap) return townMapSurfaceAt(townMap.colliders, townMap.place, x, z)
  return groundSurfaceAt(TEST_LEVEL.terrain, x, z)
}
