import { clamp, smoothstep } from '../math'
import { opennessOf, patchNoiseFor } from './clearings'

/**
 * Conjuntos de grama (docs/features/049-vegetacao-e-floresta.md): como o
 * mato alto dos jogos de Pokémon — manchas fechadas de grama, com chão
 * limpo ou de grama baixa e rala entre elas. Com `clusters` na entrada
 * `tall-grass` de um bioma, a grama segue estes conjuntos pela seed (o
 * mesmo mundo, os mesmos conjuntos); sem ele, a grama espalha por igual.
 * Fica no core para a 055 perguntar "este ponto é mato alto?".
 *
 * @typedef {object} GrassClusters - o `clusters` do bioma (0 a 1, menos
 *   onde diz)
 * @property {number} density - quanto da densidade da grama do bioma fica
 *   dentro do conjunto
 * @property {number} size - largura típica (m) de um conjunto
 * @property {number} sizeVariation - quanto um conjunto foge do tamanho
 *   típico (moitinhas e campos grandes)
 * @property {number} roughness - borda recortada (0 = redonda e lisa)
 * @property {number} edge - largura da borda: pouco = corte seco, muito =
 *   esfiapada
 * @property {number} height - altura da grama no conjunto (multiplica a da
 *   grama)
 * @property {number} holes - falhas dentro do conjunto (0 = maciço)
 * @property {number} coverage - quanto do chão vira conjunto
 * @property {number} grouping - conjuntos reunidos em campos, com vazios
 *   grandes entre eles (0 = espalhados por igual)
 * @property {number} variety - quanto os conjuntos diferem entre si em
 *   densidade e altura
 * @property {number} background - densidade da grama fora dos conjuntos
 *   (fração da do bioma; 0 = chão limpo)
 * @property {number} backgroundHeight - altura da grama de fora (multiplica
 *   a da grama)
 * @property {number} clearingPreference - nos biomas com clareiras: 0 =
 *   conjuntos em qualquer lugar, 1 = só nas clareiras
 */

// Tamanho das camadas de ruído em relação ao `size` do conjunto.
const BIG_SCALE = 3
const FINE_SCALE = 1 / 3
const REGION_SCALE = 8
const HOLE_SCALE = 0.2
// Quanto da altura a variedade pode tirar (a densidade varia por inteiro).
const HEIGHT_VARIETY = 0.4
// Desvio de uma camada do ruído de manchas em volta do meio (medido) —
// para a soma das camadas virar uma fração uniforme (`coverage` = a parte
// do chão coberta).
const NOISE_SPREAD = 0.175

// Distribuição normal acumulada (aproximação de Abramowitz e Stegun).
function normalShare(z) {
  const t = 1 / (1 + 0.3275911 * Math.abs(z / Math.SQRT2))
  const erf =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) *
      t +
      0.254829592) *
      t *
      Math.exp(-(z * z) / 2)
  return z >= 0 ? (1 + erf) / 2 : (1 - erf) / 2
}

const noise = (seed, name, size) =>
  patchNoiseFor(seed, `grass-clusters:${name}`, Math.max(size, 0.5))

/**
 * O conjunto de grama em `(x, z)`: quanto é dentro dele (`inside`, 0 a 1)
 * e o que vale ali — a fração da densidade da grama do bioma (`density`) e
 * o multiplicador da altura (`height`). `openness`: quão aberto é o lugar
 * (0 = mata, 1 = clareira, `opennessOf`), ou `null` num bioma sem
 * clareiras.
 *
 * @param {number} seed
 * @param {GrassClusters} clusters
 * @returns {{ inside: number, density: number, height: number }}
 */
export function grassClusterAt(seed, clusters, x, z, openness = null) {
  const { size } = clusters
  // As camadas (a mancha, a grande e a miúda da borda) somadas, viradas
  // numa fração uniforme do chão (0 a 1).
  const big = clusters.sizeVariation
  const fine = clusters.roughness * 0.5
  const sum =
    noise(seed, 'shape', size)(x, z) -
    0.5 +
    big * (noise(seed, 'big', size * BIG_SCALE)(x, z) - 0.5) +
    fine * (noise(seed, 'fine', size * FINE_SCALE)(x, z) - 0.5)
  const spread = NOISE_SPREAD * Math.sqrt(1 + big * big + fine * fine)
  const shape = normalShare(sum / spread)

  const region = noise(seed, 'region', size * REGION_SCALE)(x, z) - 0.5
  let coverage = clusters.coverage + clusters.grouping * region * 1.2
  if (openness !== null) {
    coverage *= 1 + clusters.clearingPreference * (2 * openness - 1)
  }
  let inside = opennessOf(shape, clamp(coverage, 0, 1), {
    EDGE: Math.max(clusters.edge, 0.005),
  })

  if (clusters.holes > 0) {
    const hole = noise(seed, 'holes', size * HOLE_SCALE)(x, z)
    const threshold = 1 - clusters.holes * 0.45
    inside *= 1 - smoothstep(threshold, threshold + 0.05, hole)
  }

  const variety = clusters.variety * noise(seed, 'variety', size)(x, z)
  const density = clusters.density * (1 - variety)
  const height = clusters.height * (1 - variety * HEIGHT_VARIETY)
  return {
    inside,
    density: clusters.background + (density - clusters.background) * inside,
    height:
      clusters.backgroundHeight + (height - clusters.backgroundHeight) * inside,
  }
}

// Lado (m) da grade em que `createGrassClusterField` calcula os conjuntos
// (entre os pontos, interpola): a grama tem vários tufos por m², e calcular
// as camadas de ruído em cada um custava várias vezes o resto do bloco.
const FIELD_STEP = 1

/**
 * Os conjuntos de grama de um bioma para muitos pontos seguidos (um bloco
 * de grama): calcula `grassClusterAt` nos cantos de uma grade de
 * `FIELD_STEP` m (guardados) e interpola a densidade e a altura entre
 * eles. `opennessAt(x, z)`: a abertura do lugar (ou `null`).
 *
 * @returns {(x: number, z: number) => { density: number, height: number }}
 */
export function createGrassClusterField(seed, clusters, opennessAt) {
  const corners = new Map()
  const cornerAt = (ix, iz) => {
    const key = `${ix},${iz}`
    if (!corners.has(key)) {
      const x = ix * FIELD_STEP
      const z = iz * FIELD_STEP
      corners.set(key, grassClusterAt(seed, clusters, x, z, opennessAt(x, z)))
    }
    return corners.get(key)
  }
  const result = { density: 0, height: 1 }
  return (x, z) => {
    const fx = x / FIELD_STEP
    const fz = z / FIELD_STEP
    const ix = Math.floor(fx)
    const iz = Math.floor(fz)
    const u = fx - ix
    const v = fz - iz
    const a = cornerAt(ix, iz)
    const b = cornerAt(ix + 1, iz)
    const c = cornerAt(ix, iz + 1)
    const d = cornerAt(ix + 1, iz + 1)
    const mix = (key) =>
      (a[key] * (1 - u) + b[key] * u) * (1 - v) +
      (c[key] * (1 - u) + d[key] * u) * v
    result.density = mix('density')
    result.height = mix('height')
    return result
  }
}
