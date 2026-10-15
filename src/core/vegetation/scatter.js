import { chunkHeightAt } from '../terrain/terrainChunk'
import { slopeAt } from './vegetationDensity'

/**
 * Sorteio de pontos da vegetação por células do mundo (docs/features/049-
 * vegetacao-e-floresta.md): a posição sai de um hash da célula (sem
 * `Math.random`), então o mesmo lugar dá sempre os mesmos pontos. Mora no
 * core porque os arbustos também saem daqui e o F vasculha eles
 * (docs/features/055-itens-no-mundo.md); a grama e as flores (só visuais)
 * usam o mesmo sorteio na view (`view/vegetation/vegetationScatter.js`).
 */

/** Hash inteiro de três números → 0 a 1. */
export function hash01(a, b, c) {
  let h = Math.imul(a, 0x27d4eb2d) ^ Math.imul(b, 0x165667b1) ^ c
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b)
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
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
