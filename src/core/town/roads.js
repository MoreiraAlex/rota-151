import { GAME_CONFIG } from '../gameConfig'
import { smoothstep } from '../math'
import { createRng, deriveSeed } from '../rng'
import { heightIndex } from '../terrain/terrainChunk'

/**
 * Estradas entre as cidades (docs/features/058-ajuste-dos-biomas.md): as
 * rotas de Kanto ligando as cidades da seed (`citySites.js`). Puro e
 * determinístico, sem chunk.
 *
 * - **Ligações**: cada cidade liga à vizinha de leste (+x) **ou** à de
 *   norte (+z), pela seed — numa grade infinita isso forma uma árvore só:
 *   de toda cidade se chega a toda outra. Mais `ROADS.EXTRA` de chance de
 *   ligar também a outra (voltas e atalhos).
 * - **Traçado**: do centro de uma cidade ao da outra, sinuoso (duas curvas
 *   de lado, até `ROADS.WARP` do comprimento), em pontos a cada
 *   `ROADS.STEP` m.
 * - **Força** (0 a 1): pela distância até o traçado (`WIDTH`, `EDGE`),
 *   sumindo dentro das cidades (onde as ruas delas assumem).
 * - **Vau** (`fordAt`): a faixa mais larga (`FORD_WIDTH`) onde o leito de
 *   rio ou lago fica raso — o relevo usa (`terrainHeight.js`), e dá para
 *   atravessar a pé.
 *
 * @typedef {object} RoadEdge
 * @property {string} id
 * @property {Float64Array} points - x, z, x, z...
 * @property {number[]} box - `[minX, minZ, maxX, maxZ]` (m)
 *
 * @typedef {object} Roads
 * @property {(cellX: number, cellZ: number) => number[][]} linksOf - as
 *   células a que a cidade de `(cellX, cellZ)` liga (leste e/ou norte)
 * @property {(x: number, z: number) => number} distanceAt - m até a
 *   estrada mais perto (`Infinity` longe de todas)
 * @property {(x: number, z: number) => number} strengthAt
 * @property {(x: number, z: number) => number} fordAt
 * @property {(box: number[]) => RoadEdge[]} edgesIn - as estradas que
 *   passam perto do retângulo
 */

const EAST = [1, 0]
const NORTH = [0, 1]

/** Força (0 a 1) a `distance` m do meio de uma faixa de `width` e `edge`. */
const bandAt = (distance, width, edge) =>
  1 - smoothstep(width / 2 - edge / 2, width / 2 + edge / 2, distance)

/** Distância (m) de `(x, z)` até o segmento `(ax, az)`–`(bx, bz)`. */
function segmentDistance(x, z, ax, az, bx, bz) {
  const dx = bx - ax
  const dz = bz - az
  const length2 = dx * dx + dz * dz
  const t =
    length2 > 0
      ? Math.min(Math.max(((x - ax) * dx + (z - az) * dz) / length2, 0), 1)
      : 0
  return Math.hypot(x - (ax + dx * t), z - (az + dz * t))
}

/** Distância (m) de `(x, z)` até o traçado (`Infinity` além de `reach`). */
function edgeDistance(edge, x, z, reach) {
  const [minX, minZ, maxX, maxZ] = edge.box
  if (x < minX - reach || x > maxX + reach) return Infinity
  if (z < minZ - reach || z > maxZ + reach) return Infinity
  const { points } = edge
  let best = Infinity
  for (let i = 0; i + 3 < points.length; i += 2) {
    const ax = points[i]
    const az = points[i + 1]
    const bx = points[i + 2]
    const bz = points[i + 3]
    // Segmento longe demais (pela caixa dele) nem calcula.
    if (Math.min(ax, bx) - reach > x || Math.max(ax, bx) + reach < x) continue
    if (Math.min(az, bz) - reach > z || Math.max(az, bz) + reach < z) continue
    best = Math.min(best, segmentDistance(x, z, ax, az, bx, bz))
  }
  return best
}

/**
 * @param {number} seed
 * @param {object} options
 * @param {import('./citySites').CitySites} options.cities
 * @param {object} [options.params] - forma de `GAME_CONFIG.ROADS`
 * @returns {Roads}
 */
export function createRoads(seed, { cities, params = GAME_CONFIG.ROADS }) {
  const { EXTRA, WARP, STEP, WIDTH, EDGE, FORD_WIDTH } = params
  const reach = Math.max(WIDTH / 2 + EDGE / 2, FORD_WIDTH / 2)
  const links = new Map()
  const edges = new Map()

  function linksOf(cellX, cellZ) {
    const key = `${cellX},${cellZ}`
    if (!links.has(key)) {
      const rng = createRng(deriveSeed(seed, `road:${key}`))
      const [main, other] = rng() < 0.5 ? [EAST, NORTH] : [NORTH, EAST]
      const directions = rng() < EXTRA ? [main, other] : [main]
      links.set(
        key,
        directions.map(([dx, dz]) => [cellX + dx, cellZ + dz]),
      )
    }
    return links.get(key)
  }

  // O traçado de uma cidade à vizinha: a reta com duas curvas de lado (uma
  // grande no meio, uma menor em S), pela seed.
  function traceEdge(from, to) {
    const id = `${from.id}>${to.id}`
    const rng = createRng(deriveSeed(seed, `road-trace:${id}`))
    const dx = to.x - from.x
    const dz = to.z - from.z
    const length = Math.hypot(dx, dz)
    const sideX = -dz / length
    const sideZ = dx / length
    const bend = (rng() * 2 - 1) * WARP * length
    const wiggle = ((rng() * 2 - 1) * WARP * length) / 2
    const count = Math.max(2, Math.ceil(length / STEP) + 1)
    const points = new Float64Array(count * 2)
    const box = [Infinity, Infinity, -Infinity, -Infinity]
    for (let i = 0; i < count; i++) {
      const t = i / (count - 1)
      const side =
        Math.sin(Math.PI * t) * bend + Math.sin(2 * Math.PI * t) * wiggle
      const x = from.x + dx * t + sideX * side
      const z = from.z + dz * t + sideZ * side
      points[i * 2] = x
      points[i * 2 + 1] = z
      box[0] = Math.min(box[0], x)
      box[1] = Math.min(box[1], z)
      box[2] = Math.max(box[2], x)
      box[3] = Math.max(box[3], z)
    }
    return { id, points, box }
  }

  function edgeOf(fromCell, toCell) {
    const key = `${fromCell}>${toCell}`
    if (!edges.has(key)) {
      edges.set(
        key,
        traceEdge(cities.cityAt(...fromCell), cities.cityAt(...toCell)),
      )
    }
    return edges.get(key)
  }

  // As estradas que saem das células em volta de `(cellX, cellZ)`: o
  // traçado só vai à vizinha e a curva não passa de uma célula para o lado,
  // então as que passam pela célula estão aqui.
  function edgesAround(cellX, cellZ, out) {
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        const from = [cellX + dx, cellZ + dz]
        for (const to of linksOf(...from)) out.add(edgeOf(from, to))
      }
    }
    return out
  }

  /** As estradas que passam perto do retângulo `[minX, minZ, maxX, maxZ]`. */
  function edgesIn([minX, minZ, maxX, maxZ]) {
    const found = new Set()
    for (let x = cities.cellOf(minX); x <= cities.cellOf(maxX); x++) {
      for (let z = cities.cellOf(minZ); z <= cities.cellOf(maxZ); z++) {
        edgesAround(x, z, found)
      }
    }
    return [...found].filter(
      ({ box }) =>
        box[0] - reach <= maxX &&
        box[2] + reach >= minX &&
        box[1] - reach <= maxZ &&
        box[3] + reach >= minZ,
    )
  }

  const scratch = new Set()
  function distanceAt(x, z, candidates = null) {
    let list = candidates
    if (!list) {
      scratch.clear()
      list = edgesAround(cities.cellOf(x), cities.cellOf(z), scratch)
    }
    let best = Infinity
    for (const edge of list)
      best = Math.min(best, edgeDistance(edge, x, z, reach))
    return best
  }

  // Dentro da cidade, a estrada some (da beira do disco para dentro, na
  // borda dela): lá valem as ruas.
  function outsideCities(x, z) {
    const { city, distance } = cities.nearestCity(x, z)
    return smoothstep(city.radius - cities.edge, city.radius, distance)
  }

  function strengthAt(x, z, candidates = null) {
    const distance = distanceAt(x, z, candidates)
    if (distance === Infinity) return 0
    const band = bandAt(distance, WIDTH, EDGE)
    return band > 0 ? band * outsideCities(x, z) : 0
  }

  function fordAt(x, z) {
    const distance = distanceAt(x, z)
    return distance === Infinity ? 0 : bandAt(distance, FORD_WIDTH, EDGE)
  }

  return { linksOf, distanceAt, strengthAt, fordAt, edgesIn }
}

/**
 * Força da estrada por vértice do chunk (na ordem de `heights`), ou `null`
 * se nenhuma estrada passa por ele.
 *
 * @param {import('../terrain/terrainChunk').TerrainChunk} chunk
 * @param {Roads | null} roads
 * @returns {Float32Array | null}
 */
export function chunkRoads(chunk, roads) {
  if (!roads) return null
  const { resolution, minX, minZ, size, heights } = chunk
  const candidates = roads.edgesIn([minX, minZ, minX + size, minZ + size])
  if (candidates.length === 0) return null
  const step = size / resolution
  const values = new Float32Array(heights.length)
  let isEmpty = true
  for (let ix = 0; ix <= resolution; ix++) {
    for (let iz = 0; iz <= resolution; iz++) {
      const strength = roads.strengthAt(
        minX + ix * step,
        minZ + iz * step,
        candidates,
      )
      if (strength <= 0) continue
      values[heightIndex(resolution, ix, iz)] = strength
      isEmpty = false
    }
  }
  return isEmpty ? null : values
}
