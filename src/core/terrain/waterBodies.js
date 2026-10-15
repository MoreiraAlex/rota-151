import { createNoise2D } from 'simplex-noise'
import { GAME_CONFIG } from '../gameConfig'
import { smoothstep } from '../math'
import { createRng, deriveSeed } from '../rng'
import { layeredNoise, noiseToFraction } from './biomeMap'

/**
 * Lagos e rios (docs/features/057-lagos-e-rios.md): cavam o relevo abaixo
 * do nível da água, todos no mesmo `TERRAIN.WATER_LEVEL`. Entram no próprio
 * sampler do relevo (`terrainHeight.js`), então valem igual com e sem chunk
 * carregado e no relevo distante.
 *
 * Os dois são medidos pela distância até a beira da água (positiva dentro,
 * negativa fora): dentro, o chão desce rápido na margem e vai chegando à
 * fundura sem nunca ficar plano; fora, sobe numa encosta de inclinação
 * fixa até encontrar o relevo — em morro alto o vale fica mais largo, não
 * um cânion.
 * - **Rio**: onde um ruído torcido passa por zero (como as trilhas), com a
 *   mesma largura em todo lugar.
 * - **Lago**: as manchas mais altas de outro ruído, cobrindo
 *   `LAKE_COVERAGE` dele.
 */

// Passo (m) da diferença finita que dá a inclinação dos ruídos.
const GRADIENT_STEP = 0.5
// Quanto (m) fora da beira do rio a correnteza ainda vale (sumindo).
const FLOW_FADE = 2

/**
 * Altura (m, a partir da água) do chão cavado a `inside` m da beira — dentro
 * da água desce até `depth` com a inclinação `shoreSlope` na beira; fora,
 * sobe com `bankSlope`.
 */
export function waterProfile(inside, { depth, shoreSlope, bankSlope }) {
  if (inside < 0) return -inside * bankSlope
  return -depth * (1 - Math.exp((-inside * shoreSlope) / depth))
}

/**
 * Mínimo suave (`k` m de largura): o vale encontra o relevo sem vinco. Longe
 * um do outro, é o mínimo de verdade.
 */
export function smoothMin(a, b, k) {
  const h = Math.max(k - Math.abs(a - b), 0) / k
  return Math.min(a, b) - (h * h * k) / 4
}

/**
 * Os lagos e rios de uma seed. `params` tem a forma de
 * `GAME_CONFIG.WATER_BODIES`.
 *
 * @param {number} seed
 * @param {object} [params]
 */
export function createWaterBodies(seed, params = GAME_CONFIG.WATER_BODIES) {
  const { RIVER, LAKE } = params
  const noiseFor = (name) => createNoise2D(createRng(deriveSeed(seed, name)))
  const riverLine = noiseFor('rivers')
  const riverWarpX = noiseFor('rivers:x')
  const riverWarpZ = noiseFor('rivers:z')
  const lakeNoise = noiseFor('lakes')
  const bedNoise = noiseFor('water-bed')
  const lakeThreshold = 1 - LAKE.COVERAGE

  const river = (x, z) => {
    const wx =
      x + riverWarpX(x / RIVER.WARP_SIZE, z / RIVER.WARP_SIZE) * RIVER.WARP
    const wz =
      z + riverWarpZ(x / RIVER.WARP_SIZE, z / RIVER.WARP_SIZE) * RIVER.WARP
    return riverLine(wx / RIVER.SIZE, wz / RIVER.SIZE)
  }
  // O ruído em camadas do mapa de biomas: a fração dele é calibrada.
  const lake = (x, z) =>
    noiseToFraction(layeredNoise(lakeNoise, x, z, LAKE.SIZE))

  // Valor do campo dividido pela inclinação dele: a distância (m) até onde
  // ele vale zero.
  const distanceToZero = (field, x, z, offset) => {
    const value = field(x, z) - offset
    const slope = Math.hypot(
      (field(x + GRADIENT_STEP, z) - offset - value) / GRADIENT_STEP,
      (field(x, z + GRADIENT_STEP) - offset - value) / GRADIENT_STEP,
    )
    return value / Math.max(slope, 1e-9)
  }

  /** Quanto (m) o rio fica para dentro da beira em `(x, z)`. */
  const insideRiver = (x, z) =>
    RIVER.WIDTH / 2 - Math.abs(distanceToZero(river, x, z, 0))

  /** Quanto (m) o lago fica para dentro da beira em `(x, z)`. */
  const insideLake = (x, z) => distanceToZero(lake, x, z, lakeThreshold)

  // Um pouco de ruído no fundo (nunca uma célula plana — ver a 081 do
  // roadmap), crescendo da beira para dentro.
  const bedAt = (x, z, inside) =>
    inside <= 0
      ? 0
      : params.BED_ROUGHNESS *
        (0.5 + 0.5 * bedNoise(x / params.BED_SIZE, z / params.BED_SIZE)) *
        (1 - Math.exp(-inside))

  const carve = (land, target) => smoothMin(land, target, params.BLEND)

  /**
   * A altura (m, a partir da água) em `(x, z)` com os lagos e rios cavados
   * em `land`. `rivers` e `lakes` (0 a 1) dizem quanto o lugar aceita de
   * cada um (do bioma — `water` dele).
   */
  function carveAt(x, z, land, { rivers, lakes }) {
    const clear = smoothstep(
      params.SPAWN_CLEAR_RADIUS / 2,
      params.SPAWN_CLEAR_RADIUS,
      Math.hypot(x, z),
    )
    const riverShare = rivers * clear
    const lakeShare = lakes * clear
    let height = land
    if (riverShare > 0) {
      const inside = insideRiver(x, z)
      const target =
        waterProfile(inside, {
          depth: RIVER.DEPTH,
          shoreSlope: RIVER.SHORE_SLOPE,
          bankSlope: params.BANK_SLOPE,
        }) - bedAt(x, z, inside)
      height += riverShare * (carve(height, target) - height)
    }
    if (lakeShare > 0) {
      const inside = insideLake(x, z)
      const target =
        waterProfile(inside, {
          depth: LAKE.DEPTH,
          shoreSlope: LAKE.SHORE_SLOPE,
          bankSlope: params.BANK_SLOPE,
        }) - bedAt(x, z, inside)
      height += lakeShare * (carve(height, target) - height)
    }
    return height
  }

  /**
   * Correnteza do rio em `(x, z)`: a direção ao longo dele (unitária; o
   * sentido é só um dos dois, mas o mesmo em todo o trecho) vezes quanto
   * do rio está ali (1 dentro da água, caindo a zero logo fora da beira).
   * Fora de rio, `{ x: 0, z: 0 }`. Só visual (as ondas andam nela).
   */
  function flowAt(x, z) {
    const amount = smoothstep(-FLOW_FADE, 0, insideRiver(x, z))
    if (amount <= 0) return { x: 0, z: 0 }
    const value = river(x, z)
    const gx = (river(x + GRADIENT_STEP, z) - value) / GRADIENT_STEP
    const gz = (river(x, z + GRADIENT_STEP) - value) / GRADIENT_STEP
    const length = Math.max(Math.hypot(gx, gz), 1e-9)
    // A linha do rio corre de lado para a inclinação do ruído.
    return { x: (-gz / length) * amount, z: (gx / length) * amount }
  }

  return { carveAt, insideRiver, insideLake, flowAt }
}
