import { TEST_LEVEL } from '../data/testLevel'
import { groundSurfaceAt } from '../terrain/groundSurface'

/**
 * O chão em `(x, z)` do mundo para o som do passo (`'grass'` ou
 * `'ground'`, `core/terrain/groundSurface.js`) — com o relevo de
 * `TEST_LEVEL`.
 */
export function levelGroundSurfaceAt(x, z) {
  return groundSurfaceAt(TEST_LEVEL.terrain, x, z)
}
