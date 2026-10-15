import { GAME_CONFIG } from '../gameConfig'
import { scatterArea } from './scatter'
import { createKindDensity } from './vegetationDensity'

/**
 * Os arbustos de um chunk (docs/features/055-itens-no-mundo.md): saem do
 * core, e não só da view, porque o F vasculha cada um atrás de fruta. Não
 * colidem. Mesmo sorteio do sub-bosque (`scatterArea`), com as clareiras e
 * as manchas e fora das pegadas dos sólidos — sem a qualidade gráfica: o
 * mesmo mundo para todos.
 */

// Separa o sorteio dos arbustos dos outros (`scatterArea`).
export const BUSH_SALT = 201

/**
 * @typedef {object} BushPlacement
 * @property {number} x
 * @property {number} y
 * @property {number} z
 * @property {number} yaw
 * @property {number} size - 0 a 1 (o tamanho, `lgpePlantScale`)
 * @property {number} variant - 0 a 1 (qual modelo)
 */

/** @returns {BushPlacement[]} */
export function placeChunkBushes(
  chunk,
  { biomeList, seed = chunk.vegetationSeed, params = GAME_CONFIG },
) {
  const { BUSHES, GRASS, TERRAIN } = params
  const points = scatterArea(chunk, {
    minX: chunk.minX,
    minZ: chunk.minZ,
    size: chunk.size,
    perM2: BUSHES.PER_M2,
    density: createKindDensity(chunk, 'bush', { biomeList, seed }),
    salt: BUSH_SALT,
    minHeight: TERRAIN.WATER_LEVEL + GRASS.SHORE_GAP,
    maxSlope: GRASS.MAX_SLOPE,
    avoid: chunk.solids?.footprints,
  })
  return Array.from({ length: points.count }, (_, i) => {
    const [x, y, z] = points.positions.subarray(i * 3, i * 3 + 3)
    return {
      x,
      y,
      z,
      yaw: points.yaws[i],
      size: points.sizes[i],
      variant: points.variants[i],
    }
  })
}
