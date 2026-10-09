import { GAME_CONFIG } from '../gameConfig'
import { opennessOf, patchNoiseFor } from './clearings'

/**
 * Manchas de um tipo de vegetação (docs/features/049-vegetacao-e-
 * floresta.md): com `patches: { amount, size }` no `vegetation` do bioma,
 * o tipo só nasce dentro de manchas pela seed — mais ou menos `amount` (0 a
 * 1) do chão, em manchas de `size` m — e não salpicado por igual (bosque de
 * pinheiros, tapete de samambaias, roda de cogumelos). Cada tipo tem o
 * próprio ruído, independente do bioma e da altura, como as clareiras.
 */

/**
 * Quanto do tipo fica em `(x, z)` (0 = fora da mancha, 1 = dentro), com a
 * borda suave de `VEGETATION_PATCHES.EDGE`.
 */
export function patchAt(
  seed,
  kind,
  { amount, size },
  x,
  z,
  params = GAME_CONFIG.VEGETATION_PATCHES,
) {
  const noise = patchNoiseFor(seed, `patches:${kind}`, size)(x, z)
  return opennessOf(noise, amount, params)
}
