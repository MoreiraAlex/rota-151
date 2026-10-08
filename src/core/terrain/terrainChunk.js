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
 * @property {string[]} biomeIds - ids dos biomas, na ordem dos pesos
 * @property {Uint8Array} biomeWeights - peso de cada bioma por vértice (0 a
 *   255; só para a cor): `biomeWeights[índice da altura × biomeIds.length +
 *   bioma]`
 * @property {string} biome - id do bioma com mais peso no chunk
 */

/** Chunk que contém a coordenada de mundo `value` (num eixo). */
export function chunkCoordAt(value, size = GAME_CONFIG.TERRAIN.CHUNK_SIZE) {
  return Math.floor(value / size + 0.5)
}

/** Chave do chunk `(chunkX, chunkZ)` em mapas e listas. */
export function chunkKey(chunkX, chunkZ) {
  return `${chunkX},${chunkZ}`
}

/** Índice da altura do vértice `(ix, iz)` no array `heights`. */
export function heightIndex(resolution, ix, iz) {
  return iz + ix * (resolution + 1)
}

/**
 * Gera o chunk `(chunkX, chunkZ)` a partir do relevo (`createTerrainSampler`,
 * `terrainHeight.js`): alturas e pesos dos biomas por vértice.
 * `params` tem a forma de `GAME_CONFIG.TERRAIN`.
 *
 * @returns {TerrainChunk}
 */
export function generateTerrainChunk(
  sampler,
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
  const biomeCount = sampler.biomes.length
  const biomeWeights = new Uint8Array(heights.length * biomeCount)
  const weights = new Float64Array(biomeCount)
  const biomeTotals = new Float64Array(biomeCount)

  let minHeight = Infinity
  let maxHeight = -Infinity
  for (let ix = 0; ix <= resolution; ix++) {
    for (let iz = 0; iz <= resolution; iz++) {
      const index = heightIndex(resolution, ix, iz)
      heights[index] = sampler.sample(
        minX + ix * step,
        minZ + iz * step,
        weights,
      )
      // Do valor guardado (float32), não do calculado.
      const height = heights[index]
      minHeight = Math.min(minHeight, height)
      maxHeight = Math.max(maxHeight, height)
      for (let biome = 0; biome < biomeCount; biome++) {
        biomeWeights[index * biomeCount + biome] = Math.round(
          weights[biome] * 255,
        )
        biomeTotals[biome] += weights[biome]
      }
    }
  }

  const dominant = biomeTotals.indexOf(Math.max(...biomeTotals))
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
    biomeIds: sampler.biomes.map(({ id }) => id),
    biomeWeights,
    biome: sampler.biomes[dominant].id,
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
  return triangleHeight(
    corner(0, 0),
    corner(1, 0),
    corner(0, 1),
    corner(1, 1),
    u,
    v,
  )
}

/**
 * Altura dentro de uma célula de cantos `a` (`-x,-z`), `b` (`+x,-z`), `c`
 * (`-x,+z`) e `d` (`+x,+z`), em `(u, v)` de 0 a 1 — a triangulação do
 * colisor (diagonal de `b` a `c`).
 */
function triangleHeight(a, b, c, d, u, v) {
  if (u + v <= 1) return a + (b - a) * u + (c - a) * v
  return d + (c - d) * (1 - u) + (b - d) * (1 - v)
}

/**
 * Altura em `(x, z)` com os mesmos vértices e triângulos que um chunk
 * teria ali, direto do ruído (`createTerrainSampler`) — vale
 * com o chunk carregado ou não (docs/features/046-sistema-de-chunks.md). Os
 * vértices ficam onde os dos chunks ficam (a cada metro a partir da borda
 * de um chunk) e as alturas passam por float32, como em `heights`.
 */
export function latticeHeightAt(
  sampler,
  x,
  z,
  size = GAME_CONFIG.TERRAIN.CHUNK_SIZE,
) {
  // Borda de chunk: `(chunkX - 0.5) × size`; um vértice por metro.
  const offset = -size / 2
  const fx = x - offset
  const fz = z - offset
  const ix = Math.floor(fx)
  const iz = Math.floor(fz)

  const corner = (dx, dz) =>
    Math.fround(sampler.heightAt(offset + ix + dx, offset + iz + dz))
  return triangleHeight(
    corner(0, 0),
    corner(1, 0),
    corner(0, 1),
    corner(1, 1),
    fx - ix,
    fz - iz,
  )
}
