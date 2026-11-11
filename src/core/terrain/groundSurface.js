import { listBiomes } from '../data/biomes'
import { GAME_CONFIG } from '../gameConfig'
import {
  createKindDensity,
  densityAt,
  kindDensities,
  slopeAt,
} from '../vegetation/vegetationDensity'

/**
 * O chão em `(x, z)` para o som do passo (docs/features/066-revisao-dos-
 * biomas.md): `'grass'` dentro das manchas de grama — a mesma conta que
 * decide onde a grama nasce (`createKindDensity` da `tall-grass`:
 * conjuntos, clareiras, trilhas), sem a densidade em si: a parte dela no
 * ponto chega a `GROUND_SURFACE.GRASS` — fora de encosta íngreme e com a
 * grama à mostra (`GRASS.VISIBLE`); `'ground'` no resto e fora dos chunks
 * carregados. A água é à parte (`levelWaterDepthAt`).
 *
 * @param {object} terrain - `loadedChunkAt` (`TEST_LEVEL.terrain`)
 * @returns {'grass' | 'ground'}
 */
export function groundSurfaceAt(
  terrain,
  x,
  z,
  params = GAME_CONFIG.GROUND_SURFACE,
  grass = GAME_CONFIG.GRASS,
) {
  if (!grass.VISIBLE) return 'ground'
  const chunk = terrain.loadedChunkAt(x, z)
  if (!chunk) return 'ground'
  if (slopeAt(chunk, x, z) > grass.MAX_SLOPE) return 'ground'
  const { density, densities } = grassOf(chunk)
  const base = densityAt(chunk, densities, x, z)
  if (base <= 0) return 'ground'
  return density.at(x, z) / base >= params.GRASS ? 'grass' : 'ground'
}

// A densidade da grama de cada chunk (montada uma vez por chunk: o campo
// dos conjuntos guarda os cantos já calculados).
const grassByChunk = new WeakMap()
function grassOf(chunk) {
  let grass = grassByChunk.get(chunk)
  if (!grass) {
    const biomeList = listBiomes()
    grass = {
      density: createKindDensity(chunk, 'tall-grass', {
        biomeList,
        seed: chunk.vegetationSeed ?? 0,
      }),
      densities: kindDensities(biomeList, chunk.biomeIds, 'tall-grass'),
    }
    grassByChunk.set(chunk, grass)
  }
  return grass
}
