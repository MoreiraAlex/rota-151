import { createNoise2D } from 'simplex-noise'
import { listBiomes } from '../data/biomes'
import { GAME_CONFIG } from '../gameConfig'
import { createRng, deriveSeed } from '../rng'

/** Eixos do clima, na ordem dos valores de `climateAt`. */
export const CLIMATE_AXES = ['temperature', 'humidity', 'continent', 'relief']
const CONTINENT_AXIS = CLIMATE_AXES.indexOf('continent')

// Camadas de simplex somadas em cada ruído do mapa (cada uma com metade do
// tamanho e metade do peso da anterior) — o contorno das manchas fica
// irregular sem virar chuvisco.
const NOISE_LAYERS = 2
// Desvio padrão (medido) da soma de camadas acima: a curva normal com ele
// leva o ruído para 0 a 1 quase por igual — assim a faixa de clima de um
// bioma é a fração do mundo que ele disputa.
const LAYERED_NOISE_SPREAD = 0.325

/** Soma de camadas de simplex em `(x, z)`, com manchas do tamanho `size`. */
function layeredNoise(noise2D, x, z, size) {
  let sum = 0
  let weight = 1
  let totalWeight = 0
  let frequency = 1 / size
  for (let layer = 0; layer < NOISE_LAYERS; layer++) {
    sum += noise2D(x * frequency, z * frequency) * weight
    totalWeight += weight
    weight /= 2
    frequency *= 2
  }
  return sum / totalWeight
}

// Função erro (aproximação de Abramowitz e Stegun, erro < 1e-6).
function erf(value) {
  const sign = Math.sign(value)
  const x = Math.abs(value)
  const t = 1 / (1 + 0.3275911 * x)
  const poly =
    t *
    (0.254829592 +
      t *
        (-0.284496736 +
          t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))))
  return sign * (1 - poly * Math.exp(-x * x))
}

/** Ruído em camadas (em volta de 0) → fração de 0 a 1. */
export function noiseToFraction(value) {
  return 0.5 * (1 + erf(value / (LAYERED_NOISE_SPREAD * Math.SQRT2)))
}

const smoothstep = (edge0, edge1, value) => {
  const t = Math.min(Math.max((value - edge0) / (edge1 - edge0), 0), 1)
  return t * t * (3 - 2 * t)
}

/** Faixa `[mín, máx]` de cada eixo do bioma (eixo omitido = 0 a 1). */
const climateRanges = (biome) =>
  CLIMATE_AXES.map((axis) => biome.climate?.[axis] ?? [0, 1])

/** Quanto `value` está fora de `[min, max]` (0 dentro). */
const outside = (value, [min, max]) =>
  value < min ? min - value : value > max ? value - max : 0

// Quantos pontos da grade do mapa ficam guardados — os de volta dos chunks
// carregados cabem com folga; passou disso, começa de novo (o mapa não
// muda, só é recalculado).
const MAX_CACHED_NODES = 1 << 16
// Deslocamento que deixa o índice de um ponto da grade positivo na chave do
// cache.
const NODE_KEY_OFFSET = 1 << 20
const nodeKey = (ix, iz) =>
  (ix + NODE_KEY_OFFSET) * 2 * NODE_KEY_OFFSET + (iz + NODE_KEY_OFFSET)

/**
 * Pesos da B-spline cúbica uniforme em `t` (0 a 1, dentro da célula) para os
 * 4 pontos da grade em volta (do anterior ao seguinte do seguinte). Somam 1
 * e nunca são negativos.
 */
function cubicBSpline(t, out) {
  const t2 = t * t
  const t3 = t2 * t
  const u = 1 - t
  out[0] = (u * u * u) / 6
  out[1] = (3 * t3 - 6 * t2 + 4) / 6
  out[2] = (-3 * t3 + 3 * t2 + 3 * t + 1) / 6
  out[3] = t3 / 6
  return out
}

/**
 * Mapa de biomas (docs/features/047-biomas.md): em qualquer `(x, z)` do
 * mundo, o peso de cada bioma — quase sempre um só; dois ou três na faixa
 * de transição da fronteira. Determinístico: mesma seed e mesmos dados,
 * mesmo mapa. Nunca depende da altura (é a altura que depende dele,
 * `terrainHeight.js`).
 *
 * Cada bioma disputa cada ponto com uma pontuação:
 * - o **clima** (`climateAt`): temperatura, umidade e relevo em manchas de
 *   `CLIMATE_SIZE`, continentalidade em `CONTINENT_SIZE`. Fora da faixa
 *   do bioma (`climate`), ele perde `CLIMATE_SHARPNESS` por unidade — o
 *   clima mantém a vizinhança coerente;
 * - as **manchas próprias** do bioma (`patchScore`), do tamanho do `size`
 *   dele, cobrindo `PATCH_COVERAGE` do mundo e pesando
 *   `PRESENCE_STRENGTH` — decidem entre biomas do mesmo clima, como
 *   camadas: o menor bioma fica por cima, e onde nenhuma mancha cobre vale
 *   o maior (o fundo). Assim cada bioma tem o próprio tamanho.
 *
 * Quem pontua mais vence; quem fica a menos de `BLEND` do vencedor mistura.
 *
 * A disputa é feita numa grade de `BLEND_CELL` metros (alinhada ao mundo, os
 * pontos ficam em cache) e suavizada entre os pontos por uma B-spline
 * cúbica: a transição entre dois biomas dura umas três células, nunca
 * menos — o relevo não ganha degrau nem quando a disputa vira de repente
 * (borda de mancha pequena).
 *
 * Perto da origem a continentalidade nunca fica abaixo de
 * `SPAWN_CONTINENT` (some aos poucos até `SPAWN_LAND_RADIUS`): quem nasce
 * em `(0, y, 0)` está sempre em terra firme.
 *
 * `params` tem a forma de `GAME_CONFIG.BIOMES`; `biomes`, a lista do
 * registro (`core/data/biomes/`) — os testes passam outros.
 */
export function createBiomeSampler(
  seed,
  { params = GAME_CONFIG.BIOMES, biomes = listBiomes() } = {},
) {
  const {
    CLIMATE_SIZE,
    CONTINENT_SIZE,
    CLIMATE_SHARPNESS,
    PRESENCE_STRENGTH,
    PATCH_COVERAGE,
    PATCH_EDGE,
    BLEND,
    BLEND_CELL,
    SPAWN_CONTINENT,
    SPAWN_LAND_RADIUS,
  } = params
  const noiseFor = (name) => createNoise2D(createRng(deriveSeed(seed, name)))
  const climateNoises = CLIMATE_AXES.map((axis) => noiseFor(`climate:${axis}`))
  const climateSizes = CLIMATE_AXES.map((_, axis) =>
    axis === CONTINENT_AXIS ? CONTINENT_SIZE : CLIMATE_SIZE,
  )
  const presenceNoises = biomes.map(({ id }) => noiseFor(`presence:${id}`))
  const ranges = biomes.map(climateRanges)
  const count = biomes.length
  // Prioridade pelo tamanho: o menor bioma fica por cima (1), o maior por
  // baixo (0).
  const sizes = [...new Set(biomes.map(({ size }) => size))].sort(
    (a, b) => b - a,
  )
  const priorities = biomes.map(({ size }) =>
    sizes.length > 1 ? sizes.indexOf(size) / (sizes.length - 1) : 0,
  )
  const patchThreshold = 1 - PATCH_COVERAGE

  // Rascunho reaproveitado a cada ponto (sem alocar no laço quente).
  const climate = new Float64Array(CLIMATE_AXES.length)
  const scores = new Float64Array(count)
  const fit = new Float64Array(count)
  const splineX = new Float64Array(4)
  const splineZ = new Float64Array(4)

  /**
   * Mancha do bioma `i` em `(x, z)`: de -1 (fora) a +1 (dentro), passando
   * por 0 na borda (`PATCH_EDGE` de largura). Vezes 1 + prioridade: dentro
   * das manchas o menor bioma vence o maior; fora de todas, o maior perde
   * menos — é o fundo.
   */
  function patchScore(i, x, z) {
    const presence = noiseToFraction(
      layeredNoise(presenceNoises[i], x, z, biomes[i].size),
    )
    const inside = smoothstep(
      patchThreshold - PATCH_EDGE,
      patchThreshold + PATCH_EDGE,
      presence,
    )
    return (2 * inside - 1) * (1 + priorities[i])
  }

  /** Clima em `(x, z)`, cada eixo de 0 a 1, na ordem de `CLIMATE_AXES`. */
  function climateAt(x, z, out = climate) {
    for (let axis = 0; axis < CLIMATE_AXES.length; axis++) {
      out[axis] = noiseToFraction(
        layeredNoise(climateNoises[axis], x, z, climateSizes[axis]),
      )
    }
    const spawnLand =
      SPAWN_CONTINENT * (1 - smoothstep(0, SPAWN_LAND_RADIUS, Math.hypot(x, z)))
    out[CONTINENT_AXIS] = Math.max(out[CONTINENT_AXIS], spawnLand)
    return out
  }

  /** A disputa em `(x, z)`: pesos em `out` (somam 1). */
  function contest(x, z, out) {
    climateAt(x, z)

    let bestFit = -Infinity
    for (let i = 0; i < count; i++) {
      let penalty = 0
      for (let axis = 0; axis < CLIMATE_AXES.length; axis++) {
        penalty += outside(climate[axis], ranges[i][axis])
      }
      fit[i] = -penalty * CLIMATE_SHARPNESS
      bestFit = Math.max(bestFit, fit[i])
    }

    // A mancha vale no máximo ±2 × PRESENCE_STRENGTH: quem está tão fora
    // do clima que nem com ela chegaria à faixa de mistura nem calcula o
    // ruído.
    const hopeless = bestFit - 4 * PRESENCE_STRENGTH - BLEND
    let best = 0
    for (let i = 0; i < count; i++) {
      scores[i] =
        fit[i] < hopeless
          ? -Infinity
          : fit[i] + PRESENCE_STRENGTH * patchScore(i, x, z)
      if (scores[i] > scores[best]) best = i
    }

    let total = 0
    for (let i = 0; i < count; i++) {
      const closeness = Math.max(0, 1 - (scores[best] - scores[i]) / BLEND)
      out[i] = closeness * closeness
      total += out[i]
    }
    for (let i = 0; i < count; i++) out[i] /= total
    return out
  }

  const nodes = new Map()
  /** Pesos da disputa no ponto `(ix, iz)` da grade (em cache). */
  function nodeWeights(ix, iz) {
    const key = nodeKey(ix, iz)
    let weights = nodes.get(key)
    if (weights) return weights
    if (nodes.size >= MAX_CACHED_NODES) nodes.clear()
    weights = contest(ix * BLEND_CELL, iz * BLEND_CELL, new Float64Array(count))
    nodes.set(key, weights)
    return weights
  }

  // Os 4×4 pontos da grade da última célula consultada — vértices vizinhos
  // quase sempre caem na mesma célula.
  const block = []
  let blockX = NaN
  let blockZ = NaN

  /**
   * Pesos de cada bioma em `(x, z)` (na ordem de `biomes`, somam 1) em
   * `out`. Devolve o índice do bioma de maior peso.
   */
  function weightsAt(x, z, out) {
    const fx = x / BLEND_CELL
    const fz = z / BLEND_CELL
    const ix = Math.floor(fx)
    const iz = Math.floor(fz)
    if (ix !== blockX || iz !== blockZ) {
      for (let a = 0; a < 4; a++) {
        for (let b = 0; b < 4; b++) {
          block[a * 4 + b] = nodeWeights(ix - 1 + a, iz - 1 + b)
        }
      }
      blockX = ix
      blockZ = iz
    }
    cubicBSpline(fx - ix, splineX)
    cubicBSpline(fz - iz, splineZ)

    out.fill(0)
    for (let a = 0; a < 4; a++) {
      for (let b = 0; b < 4; b++) {
        const share = splineX[a] * splineZ[b]
        const node = block[a * 4 + b]
        for (let i = 0; i < count; i++) out[i] += share * node[i]
      }
    }

    let best = 0
    for (let i = 1; i < count; i++) if (out[i] > out[best]) best = i
    return best
  }

  const scratch = new Float64Array(count)

  return {
    biomes,
    climateAt: (x, z) => [
      ...climateAt(x, z, new Float64Array(CLIMATE_AXES.length)),
    ],
    weightsAt,
    /** Bioma de maior peso em `(x, z)`. */
    biomeAt: (x, z) => biomes[weightsAt(x, z, scratch)],
  }
}
