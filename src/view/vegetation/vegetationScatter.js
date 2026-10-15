import { heightIndex } from '@/core/terrain/terrainChunk'
import { hash01, scatterArea } from '@/core/vegetation/scatter'

export { hash01, scatterArea }

/**
 * Onde nasce a grama e as flores (docs/features/049-vegetacao-e-
 * floresta.md). Só visual, por isso mora na view: nada colide com elas nem as
 * salva. Cosmético mas fixo — a posição sai de um hash da célula no mundo
 * (sem `Math.random`), então ao voltar a um lugar a grama é a mesma.
 *
 * O mundo é dividido em blocos de `GRASS.TILE_SIZE` m (cada um dentro de
 * um chunk só); a grama nasce e some por bloco, conforme a distância da
 * câmera (`tilesAround`).
 */

export const tileKey = (tileX, tileZ) => `${tileX},${tileZ}`

/**
 * Canto (o menor x ou z) do bloco `tile` num eixo. Os blocos são centrados
 * na origem, como os chunks (`chunkCoordAt`): com o chunk um número ímpar
 * de blocos, cada bloco cai num chunk só.
 */
export const tileStart = (tile, tileSize) => (tile - 0.5) * tileSize

const tileAt = (value, tileSize) => Math.floor(value / tileSize + 0.5)

/**
 * Blocos com alguma parte a menos de `radius` m de `(x, z)`, do mais perto
 * ao mais longe.
 *
 * @returns {{ tileX: number, tileZ: number, key: string, distance: number }[]}
 */
export function tilesAround(x, z, radius, tileSize) {
  const tiles = []
  const minX = tileAt(x - radius, tileSize)
  const maxX = tileAt(x + radius, tileSize)
  const minZ = tileAt(z - radius, tileSize)
  const maxZ = tileAt(z + radius, tileSize)
  for (let tileX = minX; tileX <= maxX; tileX++) {
    for (let tileZ = minZ; tileZ <= maxZ; tileZ++) {
      const startX = tileStart(tileX, tileSize)
      const startZ = tileStart(tileZ, tileSize)
      const nearestX = Math.max(startX, Math.min(x, startX + tileSize))
      const nearestZ = Math.max(startZ, Math.min(z, startZ + tileSize))
      const distance = Math.hypot(nearestX - x, nearestZ - z)
      if (distance > radius) continue
      tiles.push({ tileX, tileZ, key: tileKey(tileX, tileZ), distance })
    }
  }
  return tiles.sort((a, b) => a.distance - b.distance)
}

/** `scatterArea` num bloco de grama (`tileX`, `tileZ`, `tileSize`). */
export function scatterTile(chunk, { tileX, tileZ, tileSize, ...options }) {
  return scatterArea(chunk, {
    ...options,
    minX: tileStart(tileX, tileSize),
    minZ: tileStart(tileZ, tileSize),
    size: tileSize,
  })
}

/**
 * Cores da grama em `(x, z)`: as de cada bioma (`colorsByBiome`, na ordem
 * de `chunk.biomeIds`; listas do mesmo tamanho, ex.: as cores `a` e `b` em
 * RGB) misturadas pelo quanto de grama cada um põe ali (peso ×
 * densidade). Grava em `out` a partir de `offset`.
 */
export function blendGrassColors(
  chunk,
  densities,
  colorsByBiome,
  x,
  z,
  out,
  offset,
) {
  const size = colorsByBiome.find(Boolean)?.length ?? 0
  const count = chunk.biomeIds.length
  const step = chunk.size / chunk.resolution
  const ix = Math.round((x - chunk.minX) / step)
  const iz = Math.round((z - chunk.minZ) / step)
  const base = heightIndex(chunk.resolution, ix, iz) * count
  let total = 0
  for (let k = 0; k < size; k++) out[offset + k] = 0
  for (let biome = 0; biome < count; biome++) {
    const colors = colorsByBiome[biome]
    if (!colors) continue
    const weight = (chunk.biomeWeights[base + biome] / 255) * densities[biome]
    if (weight <= 0) continue
    total += weight
    for (let k = 0; k < size; k++) out[offset + k] += colors[k] * weight
  }
  if (total === 0) {
    // Vértice sem grama (a grama nasceu pela densidade dos vizinhos): a do
    // primeiro bioma do chunk que tem grama.
    const fallback = colorsByBiome.find(Boolean)
    for (let k = 0; k < size; k++) out[offset + k] = fallback?.[k] ?? 0
    return
  }
  for (let k = 0; k < size; k++) out[offset + k] /= total
}
