import { clamp, smoothstep, wrapAngle } from '../math'
import { createRng, deriveSeed } from '../rng'
import { heightIndex } from './terrainChunk'
import { terraceHeight } from './terraces'

/**
 * Montanhas com caminho até o topo (docs/features/066-revisao-dos-
 * biomas.md, Parte 7): no bioma com `relief.mountains`, algumas montanhas
 * soltas pela seed, maiores que os platôs (`terraces.js`) e no mesmo
 * jeito — patamares em volta do topo, separados por barranco. Cada
 * patamar tem UMA rampa (o barranco não acontece numa faixa estreita), e a
 * rampa de cada patamar fica um pouco mais à frente da anterior, sempre no
 * mesmo sentido: sobe-se a rampa, anda-se pelo patamar até a próxima, e o
 * caminho dá a volta na montanha até o topo. O caminho (rampas e o trecho
 * no patamar entre elas) pinta o chão como trilha e afasta a vegetação.
 *
 * As montanhas somam ao relevo do bioma (o patamar acompanha de leve o
 * chão em volta) e somem na fronteira com o peso do bioma, como o resto
 * do relevo.
 *
 * @typedef {object} Mountains - o `relief.mountains` do bioma
 * @property {number} spacing - lado (m) da célula de sorteio: no máximo uma
 *   montanha por célula, inteira dentro dela (a célula cresce se a
 *   montanha não couber)
 * @property {number} chance - chance (0 a 1) de uma célula ter montanha
 * @property {number} radius - raio (m) da base
 * @property {number} height - altura (m) do topo acima do relevo em volta
 * @property {number} sizeJitter - quanto o tamanho varia (0 a 1) de uma
 *   montanha para outra (raio e altura juntos: a inclinação não muda)
 * @property {number} wobble - quanto a base foge do círculo (0 a 1)
 * @property {number} step - altura (m) de um patamar ao outro
 * @property {number} cliff - barranco (0 a 1, como `terraces.cliff`)
 * @property {number} tilt - declive natural no topo do patamar (0 a 1, como
 *   `terraces.tilt`)
 * @property {number} pathWidth - largura (m) do caminho
 * @property {number} turn - quanto da volta (0 a 1) o caminho anda num
 *   patamar, de uma rampa até a próxima
 */

// Quantas ondas dão a volta na base (a forma fora do círculo): números
// primos entre si, para a forma não se repetir.
const WOBBLE_WAVES = [2, 3, 5]
// Largura (m) da beirada do caminho e da rampa (a passagem para o
// barranco do lado).
const PATH_EDGE = 1.5
// Folga (m) entre a beirada do barranco de baixo e o caminho no patamar.
const LEDGE_GAP = 1
// Distância (m) mínima da água no centro e no começo do caminho: a
// montanha não nasce dentro de rio ou lago.
const WATER_GAP = 12
// Onde a montanha tira a água (fração do raio da base): rio e lago cavam
// cada vez menos do começo ao fim — somem antes do pé, e o rio parece
// nascer na montanha.
const DRY_FROM = 1.25
const DRY_FULL = 0.9
// A célula da origem nunca tem montanha (o treinador nasce lá).
const SPAWN_CLEAR = 1.25
// Quantas células ficam guardadas antes de esvaziar a memória.
const MAX_CACHED_CELLS = 4096

/** Até onde (m do centro) uma montanha de raio `radius` chega (com o seco
 * em volta). */
const reachOf = (radius, wobble) =>
  radius * (1 + clamp(wobble, 0, 1)) * DRY_FROM

/** O maior alcance que uma montanha pode ter. */
const maxRadiusOf = ({ radius, sizeJitter, wobble }) =>
  reachOf(radius * (1 + clamp(sizeJitter, 0, 1)), wobble)

/** O lado (m) da célula: a montanha (e o seco em volta) sempre cabe
 * inteira nela. */
export const cellSizeOf = (params) =>
  Math.max(params.spacing, 2 * maxRadiusOf(params) + 2)

/**
 * As montanhas de um bioma pela seed: cada célula de `cellSizeOf` m tem
 * no máximo uma, inteira dentro dela. `isClear(site)` (opcional) recusa
 * uma montanha (ex.: com água em volta).
 */
export function createMountainSites(seed, biomeId, params, isClear) {
  const baseSeed = deriveSeed(seed, `mountains:${biomeId}`)
  const cell = cellSizeOf(params)
  const cache = new Map()

  function siteOfCell(cx, cz) {
    const key = `${cx}:${cz}`
    if (cache.has(key)) return cache.get(key)
    if (cache.size > MAX_CACHED_CELLS) cache.clear()
    const site = drawSite(cx, cz)
    cache.set(key, site)
    return site
  }

  function drawSite(cx, cz) {
    const rng = createRng(deriveSeed(baseSeed, `${cx}:${cz}`))
    if (rng() >= clamp(params.chance, 0, 1)) return null
    const size = 1 + (rng() * 2 - 1) * clamp(params.sizeJitter, 0, 1)
    const radius = params.radius * size
    const reach = reachOf(radius, params.wobble)
    const free = Math.max(0, cell - 2 * reach)
    const x = cx * cell + reach + rng() * free
    const z = cz * cell + reach + rng() * free
    const amps = WOBBLE_WAVES.map(() => 0.5 + rng())
    const ampSum = amps.reduce((sum, a) => sum + a, 0)
    const site = {
      x,
      z,
      radius,
      height: params.height * size,
      // Onde o caminho começa (a primeira rampa) e para que lado ele vira.
      start: rng() * Math.PI * 2,
      dir: rng() < 0.5 ? -1 : 1,
      waves: WOBBLE_WAVES.map((count, i) => ({
        count,
        amp: amps[i] / ampSum,
        phase: rng() * Math.PI * 2,
      })),
    }
    if (Math.hypot(x, z) < reach * SPAWN_CLEAR) return null
    if (isClear && !isClear(site)) return null
    return site
  }

  return {
    cell,
    /** A montanha da célula de `(x, z)` (ou `null`). */
    siteAt: (x, z) => siteOfCell(Math.floor(x / cell), Math.floor(z / cell)),
    /** As montanhas das células a até `cells` células de `(x, z)`. */
    sitesAround(x, z, cells = 1) {
      const cx = Math.floor(x / cell)
      const cz = Math.floor(z / cell)
      const found = []
      for (let dx = -cells; dx <= cells; dx++) {
        for (let dz = -cells; dz <= cells; dz++) {
          const site = siteOfCell(cx + dx, cz + dz)
          if (site) found.push(site)
        }
      }
      return found
    },
  }
}

/** O raio (m) da base da montanha na direção `angle` (fora do círculo). */
export function baseRadiusAt(site, angle, wobble) {
  let shape = 0
  for (const { count, amp, phase } of site.waves) {
    shape += amp * Math.sin(count * angle + phase)
  }
  return site.radius * (1 + clamp(wobble, 0, 1) * shape)
}

/** Ângulo (radianos) da rampa do patamar `level`. */
export const rampAngleOf = (site, level, turn) =>
  site.start + site.dir * level * turn * Math.PI * 2

// Fora da montanha: nada a somar, sem caminho.
const EMPTY = { natural: 0, height: 0, path: 0 }

/**
 * A montanha `site` em `(x, z)`: `natural` (m, o morro liso), `height`
 * (m, com patamares, barranco e rampas — a que vai para o relevo) e
 * `path` (0 a 1, o caminho até o topo).
 */
export function mountainAt(site, x, z, params) {
  if (!site) return EMPTY
  const dx = x - site.x
  const dz = z - site.z
  const distance = Math.hypot(dx, dz)
  const angle = Math.atan2(dz, dx)
  const base = baseRadiusAt(site, angle, params.wobble)
  const t = distance / base
  if (t >= 1) return EMPTY

  // O morro liso: sobe devagar no pé e no topo, mais forte no meio.
  const rise = 1 - t
  const natural = site.height * smoothstep(0, 1, rise)
  if (!(params.step > 0)) return { natural, height: natural, path: 0 }
  const stepped = terraceHeight(natural, {
    step: params.step,
    cliff: params.cliff,
    tilt: params.tilt,
  })

  const level = Math.floor(natural / params.step)
  const within = natural / params.step - level
  const half = params.pathWidth / 2
  // A rampa deste patamar: perto do ângulo dela (em metros pela volta),
  // o degrau não acontece e o morro liso volta. O patamar do topo não tem
  // barranco acima — nem rampa (viraria um calombo no topo).
  const topLevel = Math.floor(site.height / params.step)
  const rampArc =
    Math.abs(wrapAngle(angle - rampAngleOf(site, level, params.turn))) *
    distance
  const ramp =
    level >= topLevel
      ? 0
      : 1 - smoothstep(half - PATH_EDGE, half + PATH_EDGE, rampArc)
  const height = stepped + (natural - stepped) * ramp

  // O trecho no patamar: da rampa de baixo (por onde se chega, na beirada
  // de fora) até a deste patamar, andando no sentido do caminho, rente à
  // beirada.
  let ledge = 0
  if (level > 0) {
    const from = rampAngleOf(site, level - 1, params.turn)
    const span = clamp(params.turn, 0, 1) * Math.PI * 2
    const along =
      (((site.dir * (angle - from)) % (Math.PI * 2)) + Math.PI * 2) %
      (Math.PI * 2)
    if (along <= span) {
      // Metros do patamar por unidade de `within` (pela inclinação do
      // morro liso aqui).
      const slope = (site.height * 6 * rise * (1 - rise)) / Math.max(base, 1e-6)
      const fromEdge = (within * params.step) / Math.max(slope, 1e-6)
      const lane = Math.abs(fromEdge - LEDGE_GAP - half)
      ledge = 1 - smoothstep(half - PATH_EDGE, half + PATH_EDGE, lane)
    }
  }
  return { natural, height, path: Math.max(ramp, ledge) }
}

/**
 * O centro de `site` e o começo do caminho ficam longe da água?
 * (`insideWater(x, z)`: m para dentro da beira, negativo fora). O resto
 * da montanha tira a água de baixo dela (`dryShareAt`).
 */
export function isDryAround(site, params, insideWater) {
  const foot = pathStartOf(site, params)
  return (
    insideWater(site.x, site.z) < -WATER_GAP &&
    insideWater(foot.x, foot.z) < -WATER_GAP
  )
}

/**
 * Quanto a montanha `site` tira a água em `(x, z)` (0 a 1): toda debaixo
 * dela, nada um pouco além do pé.
 */
export function dryShareAt(site, x, z, params) {
  if (!site) return 0
  const dx = x - site.x
  const dz = z - site.z
  const base = baseRadiusAt(site, Math.atan2(dz, dx), params.wobble)
  return 1 - smoothstep(DRY_FULL, DRY_FROM, Math.hypot(dx, dz) / base)
}

/**
 * Onde começa o caminho de `site`: o pé da primeira rampa, um pouco fora
 * da base.
 */
export function pathStartOf(site, params, margin = 4) {
  const reach = baseRadiusAt(site, site.start, params.wobble) + margin
  return {
    x: site.x + Math.cos(site.start) * reach,
    z: site.z + Math.sin(site.start) * reach,
  }
}

/**
 * O caminho das montanhas por vértice do chunk (na ordem de `heights`), ou
 * `null` se o chunk não tem caminho: vai no canal das trilhas
 * (`chunk.trails`) — pinta o chão e a vegetação não nasce nele. Não afunda
 * o relevo (a rampa já é o caminho).
 *
 * @param {import('./terrainChunk').TerrainChunk} chunk
 * @param {{ hasMountains: boolean,
 *   mountainPathAt: (x: number, z: number) => number }} sampler
 * @param {number} waterLevel
 */
export function chunkMountainPaths(chunk, sampler, waterLevel) {
  if (!sampler.hasMountains) return null
  const { resolution, heights } = chunk
  const step = chunk.size / resolution
  const paths = new Float32Array(heights.length)
  let isEmpty = true
  for (let ix = 0; ix <= resolution; ix++) {
    for (let iz = 0; iz <= resolution; iz++) {
      const index = heightIndex(resolution, ix, iz)
      if (heights[index] <= waterLevel) continue
      const path = sampler.mountainPathAt(
        chunk.minX + ix * step,
        chunk.minZ + iz * step,
      )
      if (path <= 0) continue
      paths[index] = Math.min(1, path)
      isEmpty = false
    }
  }
  return isEmpty ? null : paths
}

/**
 * As trilhas do chunk (`trails`, por vértice) sem o trecho em cima das
 * montanhas — subiriam barranco e confundiriam o caminho até o topo. Chama
 * antes de afundar as trilhas. Muda e devolve `trails` (`null` fica
 * `null`).
 *
 * @param {import('./terrainChunk').TerrainChunk} chunk
 * @param {Float32Array | null} trails
 * @param {{ hasMountains: boolean,
 *   mountainCoverAt: (x: number, z: number) => number }} sampler
 */
export function trailsOffMountains(chunk, trails, sampler) {
  if (!trails || !sampler.hasMountains) return trails
  const { resolution } = chunk
  const step = chunk.size / resolution
  for (let ix = 0; ix <= resolution; ix++) {
    for (let iz = 0; iz <= resolution; iz++) {
      const index = heightIndex(resolution, ix, iz)
      if (trails[index] <= 0) continue
      const cover = sampler.mountainCoverAt(
        chunk.minX + ix * step,
        chunk.minZ + iz * step,
      )
      trails[index] *= 1 - Math.min(1, cover)
    }
  }
  return trails
}
