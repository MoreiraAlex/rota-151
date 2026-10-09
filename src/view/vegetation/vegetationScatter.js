import { chunkHeightAt, heightIndex } from '@/core/terrain/terrainChunk'
import { slopeAt } from '@/core/vegetation/vegetationDensity'

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

/** Hash inteiro de três números → 0 a 1. */
export function hash01(a, b, c) {
  let h = Math.imul(a, 0x27d4eb2d) ^ Math.imul(b, 0x165667b1) ^ c
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b)
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

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

/**
 * @typedef {object} ScatterPoints
 * @property {number} count
 * @property {Float32Array} positions - x, y, z de cada ponto
 * @property {Float32Array} yaws - giro (rad)
 * @property {Float32Array} sizes - 0 a 1 por ponto (para sortear o tamanho)
 * @property {Float32Array} variants - 0 a 1 por ponto (qual modelo)
 */

const EMPTY = {
  count: 0,
  positions: new Float32Array(),
  yaws: new Float32Array(),
  sizes: new Float32Array(),
  variants: new Float32Array(),
}

// O ponto cai dentro da pegada de algum objeto sólido?
const isInside = (footprints, x, z) =>
  footprints.some(
    (circle) => Math.hypot(circle.x - x, circle.z - z) < circle.radius,
  )

/**
 * Pontos de um tipo de vegetação num quadrado do mundo: uma candidata por
 * célula de uma grade com `perM2` células por m² (posição sorteada dentro
 * da célula), que fica pela densidade do tipo no lugar (`density`, de
 * `createKindDensity` — com as clareiras). Sem nada perto da água
 * (`minHeight`), em encosta (`maxSlope`) nem dentro das pegadas dos objetos
 * sólidos (`avoid`).
 *
 * @param {import('@/core/terrain/terrainChunk').TerrainChunk} chunk - o
 *   chunk que contém o quadrado
 * @param {object} options
 * @param {number} options.minX - canto do quadrado
 * @param {number} options.minZ
 * @param {number} options.size - lado (m)
 * @param {number} options.perM2 - candidatas por m²
 * @param {import('@/core/vegetation/vegetationDensity').KindDensity} options.density
 * @param {number} options.salt - separa os tipos (grama, flor...)
 * @param {number} options.minHeight
 * @param {number} options.maxSlope
 * @param {import('@/core/vegetation/solidPlacement').Footprint[]} [options.avoid]
 * @returns {ScatterPoints}
 */
export function scatterArea(
  chunk,
  { minX, minZ, size, perM2, density, salt, minHeight, maxSlope, avoid = [] },
) {
  if (density.isEmpty || perM2 <= 0) return EMPTY
  const cell = 1 / Math.sqrt(perM2)
  const maxX = minX + size
  const maxZ = minZ + size
  const positions = []
  const yaws = []
  const sizes = []
  const variants = []

  for (let cellX = Math.floor(minX / cell); cellX * cell < maxX; cellX++) {
    for (let cellZ = Math.floor(minZ / cell); cellZ * cell < maxZ; cellZ++) {
      const x = (cellX + hash01(cellX, cellZ, salt)) * cell
      const z = (cellZ + hash01(cellX, cellZ, salt + 1)) * cell
      if (x < minX || x >= maxX || z < minZ || z >= maxZ) continue
      if (hash01(cellX, cellZ, salt + 2) >= density.at(x, z)) continue
      const y = chunkHeightAt(chunk, x, z)
      if (y < minHeight || slopeAt(chunk, x, z) > maxSlope) continue
      if (isInside(avoid, x, z)) continue
      positions.push(x, y, z)
      yaws.push(hash01(cellX, cellZ, salt + 3) * Math.PI * 2)
      sizes.push(hash01(cellX, cellZ, salt + 4))
      variants.push(hash01(cellX, cellZ, salt + 5))
    }
  }
  return {
    count: yaws.length,
    positions: Float32Array.from(positions),
    yaws: Float32Array.from(yaws),
    sizes: Float32Array.from(sizes),
    variants: Float32Array.from(variants),
  }
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
 * de `chunk.biomeIds`; 12 números — raiz, ponta, raiz B e ponta B, RGB)
 * misturadas pelo quanto de grama cada um põe ali (peso × densidade). Grava
 * em `out` a partir de `offset`.
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
  const count = chunk.biomeIds.length
  const step = chunk.size / chunk.resolution
  const ix = Math.round((x - chunk.minX) / step)
  const iz = Math.round((z - chunk.minZ) / step)
  const base = heightIndex(chunk.resolution, ix, iz) * count
  let total = 0
  for (let k = 0; k < 12; k++) out[offset + k] = 0
  for (let biome = 0; biome < count; biome++) {
    const colors = colorsByBiome[biome]
    if (!colors) continue
    const weight = (chunk.biomeWeights[base + biome] / 255) * densities[biome]
    if (weight <= 0) continue
    total += weight
    for (let k = 0; k < 12; k++) out[offset + k] += colors[k] * weight
  }
  if (total === 0) {
    // Vértice sem grama (a grama nasceu pela densidade dos vizinhos): a do
    // primeiro bioma do chunk que tem grama.
    const fallback = colorsByBiome.find(Boolean)
    for (let k = 0; k < 12; k++) out[offset + k] = fallback?.[k] ?? 0
    return
  }
  for (let k = 0; k < 12; k++) out[offset + k] /= total
}
