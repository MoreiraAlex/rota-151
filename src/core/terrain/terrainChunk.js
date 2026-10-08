import { GAME_CONFIG } from '../gameConfig'
import { clamp } from '../math'

/**
 * Um chunk de relevo: quadrado de `size` m centrado em
 * `(chunkX × size, chunkZ × size)` — o chunk `(0, 0)` fica no meio da origem.
 * As alturas são amostradas em coordenada de MUNDO, então a borda de um
 * chunk é igual à do vizinho (docs/features/045-terreno-de-um-chunk.md).
 *
 * Ordem das alturas = a do heightfield do Rapier (`createTerrainChunkCollider`,
 * `core/physics/colliders.js`): por coluna, `iz + ix × (resolution + 1)`, com
 * `ix` ao longo de X e `iz` ao longo de Z, a partir do canto `-x,-z`.
 *
 * @typedef {object} TerrainChunk
 * @property {number} chunkX
 * @property {number} chunkZ
 * @property {number} version - versão de geração (`TERRAIN.GENERATION_VERSION`)
 * @property {number} size - lado (m)
 * @property {number} resolution - células por lado
 * @property {number} minX - canto -x,-z (m)
 * @property {number} minZ
 * @property {Float32Array} heights - `(resolution + 1)²` alturas (m)
 * @property {number} minHeight
 * @property {number} maxHeight
 */

/** Chunk que contém a coordenada de mundo `value` (num eixo). */
export function chunkCoordAt(value, size = GAME_CONFIG.TERRAIN.CHUNK_SIZE) {
  return Math.floor(value / size + 0.5)
}

/** Índice da altura do vértice `(ix, iz)` no array `heights`. */
export function heightIndex(resolution, ix, iz) {
  return iz + ix * (resolution + 1)
}

/**
 * Gera o chunk `(chunkX, chunkZ)` a partir de `heightAt` (`createHeightSampler`).
 * `params` tem a forma de `GAME_CONFIG.TERRAIN`.
 *
 * @returns {TerrainChunk}
 */
export function generateTerrainChunk(
  heightAt,
  chunkX,
  chunkZ,
  params = GAME_CONFIG.TERRAIN,
) {
  const size = params.CHUNK_SIZE
  // Um vértice por metro.
  const resolution = size
  const step = size / resolution
  const minX = (chunkX - 0.5) * size
  const minZ = (chunkZ - 0.5) * size
  const heights = new Float32Array((resolution + 1) ** 2)

  let minHeight = Infinity
  let maxHeight = -Infinity
  for (let ix = 0; ix <= resolution; ix++) {
    for (let iz = 0; iz <= resolution; iz++) {
      const index = heightIndex(resolution, ix, iz)
      heights[index] = heightAt(minX + ix * step, minZ + iz * step)
      // Do valor guardado (float32), não do calculado.
      const height = heights[index]
      minHeight = Math.min(minHeight, height)
      maxHeight = Math.max(maxHeight, height)
    }
  }

  return {
    chunkX,
    chunkZ,
    version: params.GENERATION_VERSION,
    size,
    resolution,
    minX,
    minZ,
    heights,
    minHeight,
    maxHeight,
  }
}

/**
 * Altura do chunk em `(x, z)`, nos MESMOS triângulos do colisor: cada célula
 * tem a diagonal do canto `+x,-z` ao `-x,+z` (conferido no Rapier,
 * `colliders.test.js`). Fora do chunk, usa a borda mais próxima.
 */
export function chunkHeightAt(chunk, x, z) {
  const { resolution, heights } = chunk
  const step = chunk.size / resolution
  const fx = clamp((x - chunk.minX) / step, 0, resolution)
  const fz = clamp((z - chunk.minZ) / step, 0, resolution)
  const ix = Math.min(Math.floor(fx), resolution - 1)
  const iz = Math.min(Math.floor(fz), resolution - 1)
  const u = fx - ix
  const v = fz - iz

  const corner = (dx, dz) => heights[heightIndex(resolution, ix + dx, iz + dz)]
  const a = corner(0, 0)
  const b = corner(1, 0)
  const c = corner(0, 1)
  const d = corner(1, 1)

  if (u + v <= 1) return a + (b - a) * u + (c - a) * v
  return d + (c - d) * (1 - u) + (b - d) * (1 - v)
}
