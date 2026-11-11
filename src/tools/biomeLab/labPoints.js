/**
 * Pontos do laboratório de biomas (docs/features/066-revisao-dos-
 * biomas.md): um lugar de cada bioma visível perto da origem, achado pela
 * seed atual — em volta da origem, em anéis cada vez maiores, o primeiro
 * ponto em terra com o próprio bioma no centro e em volta dele.
 */

/** Os biomas que o lab oferece, na ordem do menu. */
export const LAB_BIOMES = ['forest', 'plains', 'savanna', 'city']

const DEFAULT_SEARCH = {
  // Raio máximo (m) e passo (m) entre um anel e outro.
  maxRadius: 2000,
  step: 20,
  // Distância (m) dos quatro vizinhos conferidos em volta do centro.
  margin: 25,
  // Altura mínima (m acima da água): o ponto não cai no rio nem no lago.
  minHeight: 1,
}

const NEIGHBORS = [
  [0, 0],
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
]

/**
 * O primeiro ponto de cada bioma de `biomeIds` (ou `null`, se nenhum até
 * o raio máximo).
 *
 * @param {{ biomeAt: (x: number, z: number) => { id: string },
 *   heightAt: (x: number, z: number) => number }} terrain
 * @returns {Record<string, { x: number, z: number } | null>}
 */
export function findBiomePoints(
  terrain,
  biomeIds = LAB_BIOMES,
  search = DEFAULT_SEARCH,
) {
  const { maxRadius, step, margin, minHeight } = {
    ...DEFAULT_SEARCH,
    ...search,
  }
  const found = Object.fromEntries(biomeIds.map((id) => [id, null]))
  const fits = (id, x, z) =>
    terrain.heightAt(x, z) > minHeight &&
    NEIGHBORS.every(
      ([dx, dz]) => terrain.biomeAt(x + dx * margin, z + dz * margin).id === id,
    )

  for (let radius = step; radius <= maxRadius; radius += step) {
    // Mais pontos nos anéis maiores, um a cada passo de distância.
    const count = Math.max(8, Math.round((2 * Math.PI * radius) / step))
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2
      const x = Math.round(Math.cos(angle) * radius)
      const z = Math.round(Math.sin(angle) * radius)
      for (const id of biomeIds) {
        if (!found[id] && fits(id, x, z)) found[id] = { x, z }
      }
      if (biomeIds.every((id) => found[id])) return found
    }
  }
  return found
}
