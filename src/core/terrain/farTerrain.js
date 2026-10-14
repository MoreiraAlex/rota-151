/**
 * Relevo distante (docs/features/051-montanha.md): uma grade grossa do
 * relevo da seed em volta de um centro, até o horizonte — o que a view
 * desenha além dos chunks carregados. Os vértices caem nos cantos dos
 * chunks (a célula é múltiplo do lado do chunk e o centro é um canto),
 * então a malha encosta no chão de verdade na borda deles. Puro: mesma
 * seed, mesmo centro, mesma grade.
 */

/**
 * @typedef {object} FarTerrainGrid
 * @property {number} centerX - um canto de chunk
 * @property {number} centerZ
 * @property {number} cell - lado (m) de uma célula
 * @property {number} side - vértices por lado
 * @property {number} minX - o primeiro vértice
 * @property {number} minZ
 * @property {Float32Array} heights - `side × side`, linha a linha (z, x)
 * @property {Uint8Array} biomeWeights - por vértice, um peso (0 a 255) por
 *   bioma da receita
 * @property {number} biomeCount
 * @property {number} filled - quantos vértices já foram amostrados
 */

/**
 * O canto de chunk mais perto de `(x, z)`, onde a malha se centra.
 */
export function farTerrainCenter(x, z, chunkSize) {
  // Os chunks são centrados na origem: os cantos ficam em meio chunk + um
  // número inteiro de chunks.
  const corner = (value) => (Math.floor(value / chunkSize) + 0.5) * chunkSize
  return { x: corner(x), z: corner(z) }
}

/**
 * Grade vazia em volta de `(centerX, centerZ)` (um canto de chunk, ver
 * `farTerrainCenter`) até `radius` m, com células de `cell` m.
 *
 * @returns {FarTerrainGrid}
 */
export function createFarTerrainGrid({
  centerX,
  centerZ,
  radius,
  cell,
  biomeCount,
}) {
  const cellsToEdge = Math.ceil(radius / cell)
  const side = cellsToEdge * 2 + 1
  return {
    centerX,
    centerZ,
    cell,
    side,
    minX: centerX - cellsToEdge * cell,
    minZ: centerZ - cellsToEdge * cell,
    heights: new Float32Array(side * side),
    biomeWeights: new Uint8Array(side * side * biomeCount),
    biomeCount,
    filled: 0,
  }
}

/**
 * Amostra até `maxSamples` vértices ainda vazios da grade com `sample(x,
 * z, weightsOut)` (o do conjunto de chunks: altura e pesos dos biomas).
 * Devolve se a grade ficou completa.
 */
export function fillFarTerrainGrid(grid, sample, maxSamples) {
  const { side, cell, minX, minZ, heights, biomeWeights, biomeCount } = grid
  const total = side * side
  const weights = new Float64Array(biomeCount)
  const end = Math.min(total, grid.filled + maxSamples)
  for (let index = grid.filled; index < end; index++) {
    const ix = index % side
    const iz = Math.floor(index / side)
    heights[index] = sample(minX + ix * cell, minZ + iz * cell, weights)
    for (let biome = 0; biome < biomeCount; biome++) {
      biomeWeights[index * biomeCount + biome] = Math.round(
        weights[biome] * 255,
      )
    }
  }
  grid.filled = end
  return end === total
}
