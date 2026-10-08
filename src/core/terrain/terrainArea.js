import { GAME_CONFIG } from '../gameConfig'
import { createHeightSampler } from './terrainHeight'
import {
  chunkCoordAt,
  chunkHeightAt,
  generateTerrainChunk,
} from './terrainChunk'

/**
 * Área fixa de chunks em volta da origem (`-radius` a `radius` nos dois
 * eixos) — o relevo do nível enquanto não há carregar/descarregar (046).
 * Gerada uma vez, de forma determinística (seed + parâmetros).
 *
 * `heightAt(x, z)`: dentro da área, a altura do chunk (mesmos triângulos do
 * colisor); fora, a do ruído direto (continua o relevo sem colisor).
 *
 * @typedef {object} TerrainArea
 * @property {import('./terrainChunk').TerrainChunk[]} chunks
 * @property {{ minX: number, maxX: number, minZ: number, maxZ: number }} bounds
 * @property {number} minHeight
 * @property {number} maxHeight
 * @property {(x: number, z: number) => number} heightAt
 */

/** @returns {TerrainArea} */
export function createTerrainArea({
  seed,
  radius = GAME_CONFIG.TERRAIN.AREA_RADIUS,
  params = GAME_CONFIG.TERRAIN,
}) {
  const sampler = createHeightSampler(seed, params)
  const size = params.CHUNK_SIZE
  const byCoord = new Map()
  const chunks = []

  for (let chunkX = -radius; chunkX <= radius; chunkX++) {
    for (let chunkZ = -radius; chunkZ <= radius; chunkZ++) {
      const chunk = generateTerrainChunk(sampler, chunkX, chunkZ, params)
      chunks.push(chunk)
      byCoord.set(`${chunkX},${chunkZ}`, chunk)
    }
  }

  const extent = (radius + 0.5) * size

  return {
    chunks,
    bounds: { minX: -extent, maxX: extent, minZ: -extent, maxZ: extent },
    minHeight: Math.min(...chunks.map((chunk) => chunk.minHeight)),
    maxHeight: Math.max(...chunks.map((chunk) => chunk.maxHeight)),
    heightAt(x, z) {
      const key = `${chunkCoordAt(x, size)},${chunkCoordAt(z, size)}`
      const chunk = byCoord.get(key)
      return chunk ? chunkHeightAt(chunk, x, z) : sampler(x, z)
    },
  }
}
