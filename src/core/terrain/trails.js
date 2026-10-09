import { createNoise2D } from 'simplex-noise'
import { GAME_CONFIG } from '../gameConfig'
import { smoothstep } from '../math'
import { createRng, deriveSeed } from '../rng'
import { chunkFieldAt, heightIndex } from './terrainChunk'

/**
 * Trilhas (docs/features/049-vegetacao-e-floresta.md): linhas sinuosas pela
 * seed nos biomas com `trails`. A trilha é onde um ruído suave (torcido
 * para serpentear) passa por zero — uma rede de caminhos que não depende do
 * chunk —, com a mesma largura em todo lugar (a distância até o zero é o
 * valor dividido pela inclinação do ruído). Cada chunk guarda a força da
 * trilha por vértice (`chunk.trails`, 0 = fora, 1 = no meio): o relevo
 * afunda nela (`carveTrails`), o chão pinta a trilha e a vegetação não
 * nasce nela (`trailAt`).
 */

// Um ruído por seed e tamanhos (montar o simplex custa; os chunks repetem).
const noiseCache = new Map()

function trailNoiseFor(seed, { SIZE, WARP, WARP_SIZE }) {
  const key = `${seed}:${SIZE}:${WARP}:${WARP_SIZE}`
  if (!noiseCache.has(key)) {
    const line = createNoise2D(createRng(deriveSeed(seed, 'trails')))
    const warpX = createNoise2D(createRng(deriveSeed(seed, 'trails:x')))
    const warpZ = createNoise2D(createRng(deriveSeed(seed, 'trails:z')))
    noiseCache.set(key, (x, z) => {
      const wx = x + warpX(x / WARP_SIZE, z / WARP_SIZE) * WARP
      const wz = z + warpZ(x / WARP_SIZE, z / WARP_SIZE) * WARP
      return line(wx / SIZE, wz / SIZE)
    })
  }
  return noiseCache.get(key)
}

/** Força da trilha (0 a 1) a `distance` m do meio dela. */
const strengthAt = (distance, { WIDTH, EDGE }) =>
  1 - smoothstep(WIDTH / 2 - EDGE / 2, WIDTH / 2 + EDGE / 2, distance)

/**
 * Força da trilha por vértice do chunk (na ordem de `heights`), ou `null`
 * se o chunk não tem trilha. Só nos biomas com `trails` (pelo peso deles no
 * vértice) e acima da água + `SHORE_GAP`.
 *
 * @param {import('./terrainChunk').TerrainChunk} chunk
 * @param {object} options
 * @param {number} options.seed
 * @param {object[]} options.biomeList - biomas da receita do relevo
 * @param {object} [options.params] - forma de `GAME_CONFIG.TRAILS`
 * @param {number} [options.waterLevel]
 * @returns {Float32Array | null}
 */
export function chunkTrails(
  chunk,
  {
    seed,
    biomeList,
    params = GAME_CONFIG.TRAILS,
    waterLevel = GAME_CONFIG.TERRAIN.WATER_LEVEL,
  },
) {
  const { resolution, biomeIds, biomeWeights, heights } = chunk
  const hasTrails = biomeIds.map(
    (id) => biomeList.find((biome) => biome.id === id)?.trails === true,
  )
  if (!hasTrails.some(Boolean)) return null

  // O ruído numa grade um vértice maior de cada lado: a inclinação sai da
  // diferença entre os vizinhos.
  const noise = trailNoiseFor(seed, params)
  const step = chunk.size / resolution
  const side = resolution + 3
  const grid = new Float32Array(side * side)
  for (let gx = 0; gx < side; gx++) {
    for (let gz = 0; gz < side; gz++) {
      grid[gx * side + gz] = noise(
        chunk.minX + (gx - 1) * step,
        chunk.minZ + (gz - 1) * step,
      )
    }
  }

  const trails = new Float32Array(heights.length)
  let isEmpty = true
  for (let ix = 0; ix <= resolution; ix++) {
    for (let iz = 0; iz <= resolution; iz++) {
      const index = heightIndex(resolution, ix, iz)
      if (heights[index] < waterLevel + params.SHORE_GAP) continue
      let share = 0
      for (let biome = 0; biome < biomeIds.length; biome++) {
        if (!hasTrails[biome]) continue
        share += biomeWeights[index * biomeIds.length + biome] / 255
      }
      if (share <= 0) continue
      const at = (dx, dz) => grid[(ix + 1 + dx) * side + iz + 1 + dz]
      const slope = Math.hypot(
        (at(1, 0) - at(-1, 0)) / (2 * step),
        (at(0, 1) - at(0, -1)) / (2 * step),
      )
      const distance = Math.abs(at(0, 0)) / Math.max(slope, 1e-6)
      const strength = strengthAt(distance, params) * Math.min(1, share)
      if (strength <= 0) continue
      trails[index] = strength
      isEmpty = false
    }
  }
  return isEmpty ? null : trails
}

/** Força da trilha (0 a 1) em `(x, z)` do chunk — 0 sem trilha. */
export function trailAt(chunk, x, z) {
  return chunk.trails ? chunkFieldAt(chunk, chunk.trails, x, z) : 0
}

/**
 * Afunda a trilha no relevo do chunk (`heights`, e o `minHeight`/
 * `maxHeight` dele): o meio desce `DEPTH` m e a beirada sobe até `BANK` m
 * (a terra empurrada para o lado). Pelos mesmos valores por vértice, dois
 * chunks vizinhos afundam igual na borda. Chama antes dos sólidos e do
 * colisor — o que se vê é o que se pisa. A altura de fora dos chunks
 * carregados (`latticeHeightAt`) não sabe da trilha.
 */
export function carveTrails(chunk, trails, params = GAME_CONFIG.TRAILS) {
  if (!trails) return
  const { heights } = chunk
  for (let index = 0; index < heights.length; index++) {
    const strength = trails[index]
    if (strength <= 0) continue
    // A beirada é onde a força está no meio do caminho (nem dentro, nem
    // fora).
    const bank = 4 * strength * (1 - strength)
    heights[index] += params.BANK * bank - params.DEPTH * strength
  }
  chunk.minHeight = Math.min(...heights)
  chunk.maxHeight = Math.max(...heights)
}
