import LGPE_COLLIDERS from '../data/lgpeColliders.json'
import { GAME_CONFIG } from '../gameConfig'
import { smoothstep } from '../math'
import { createRng, deriveSeed } from '../rng'
import { chunkHeightAt } from '../terrain/terrainChunk'
import { densityAt } from '../vegetation/vegetationDensity'
import { createCityIndex, lotKey } from './cityIndex'

/**
 * A planta das cidades (docs/features/056-bioma-cidade.md): nos biomas com
 * `town` (core/data/biomes/city/), uma grade de quarteirões alinhada ao
 * mundo — ruas nas linhas da grade e, dentro de cada quarteirão, lotes com
 * prédios e objetos de rua do Let's Go sorteados pela seed.
 *
 * - **Ruas** (`chunkStreets`): força por vértice do chunk, como as trilhas
 *   (core/terrain/trails.js), e vão no mesmo canal (`withStreets`): o chão
 *   pinta o calçamento e a vegetação não nasce nelas. Não afundam o chão.
 *   Somem na borda da cidade, onde o peso dela cai abaixo do `minShare`.
 * - **Lotes** (`placeTown`): cada quarteirão tem `lotsPerSide` × o mesmo de
 *   lotes; cada lote aberto de borda vira para uma das ruas dele e ganha um
 *   prédio de frente para ela. Cada cidade tem um Pokécenter, uma loja e um
 *   ginásio (`town.landmarks`, nos lotes que o índice de cidades escolhe —
 *   cityIndex.js), mais o prédio especial do tema da cidade; o resto são
 *   casas do tema (`houses`, pelo peso). Poste e cerca: os do tema ou os
 *   de `town.props`.
 * - **Objetos de rua**: poste nas esquinas, cerca nas casas que pedem,
 *   banco ao lado da porta dos prédios que pedem.
 *
 * Tudo é sólido (`SolidPlacement` com `model`, o id do LGPE): colide pelo
 * casco do modelo (`lgpeColliders.json`) e a pegada é a caixa dele em
 * círculos (`rectFootprints`). Determinístico: mesma seed, mesmos lotes,
 * qualquer que seja o chunk que pergunte.
 */

export const BUILDING_KIND = 'building'
export const STREET_PROP_KIND = 'street-prop'

/** A `town` dos biomas do chunk, na ordem de `chunk.biomeIds` (ou `null`). */
const townsOf = (chunk, biomeList) =>
  chunk.biomeIds.map(
    (id) => biomeList.find((biome) => biome.id === id)?.town ?? null,
  )

/**
 * Peso (0 a 1) dos biomas com `town` em `(x, z)` do chunk, interpolado
 * entre os vértices.
 */
export function townShareAt(chunk, biomeList, x, z) {
  const shares = townsOf(chunk, biomeList).map((town) => (town ? 1 : 0))
  return densityAt(chunk, shares, x, z)
}

/** Distância (m) de `value` até a linha da grade de passo `size` mais perto. */
const toGridLine = (value, size) =>
  Math.abs(value - Math.round(value / size) * size)

/** Força da rua (0 a 1) da grade `town` em `(x, z)`, sem a borda da cidade. */
export function streetStrengthAt(town, x, z) {
  const { blockSize, streetWidth, streetEdge } = town
  const distance = Math.min(toGridLine(x, blockSize), toGridLine(z, blockSize))
  return (
    1 -
    smoothstep(
      streetWidth / 2 - streetEdge / 2,
      streetWidth / 2 + streetEdge / 2,
      distance,
    )
  )
}

/** Quanto a cidade vale num ponto de peso `share` (0 na borda, 1 dentro). */
const cityFade = (share, town) =>
  smoothstep(town.minShare - GAME_CONFIG.TOWN.SHARE_FADE, town.minShare, share)

/**
 * Força da rua por vértice do chunk (na ordem de `heights`), ou `null` se o
 * chunk não tem rua.
 */
export function chunkStreets(chunk, { biomeList }) {
  const town = townsOf(chunk, biomeList).find(Boolean)
  if (!town) return null
  const { resolution, minX, minZ, size } = chunk
  const step = size / resolution
  const streets = new Float32Array(chunk.heights.length)
  let isEmpty = true
  for (let ix = 0; ix <= resolution; ix++) {
    for (let iz = 0; iz <= resolution; iz++) {
      const x = minX + ix * step
      const z = minZ + iz * step
      const strength =
        streetStrengthAt(town, x, z) *
        cityFade(townShareAt(chunk, biomeList, x, z), town)
      if (strength <= 0) continue
      streets[iz + ix * (resolution + 1)] = strength
      isEmpty = false
    }
  }
  return isEmpty ? null : streets
}

/**
 * As trilhas com as ruas por cima (a mais forte de cada vértice) — o canal
 * que o chão pinta e a vegetação evita.
 */
export function withStreets(trails, streets) {
  if (!streets) return trails
  if (!trails) return streets
  return trails.map((value, index) => Math.max(value, streets[index]))
}

/**
 * Pegada de uma caixa no chão (`box`: `[minX, minZ, maxX, maxZ]` do
 * modelo) posta em `(x, z)`, girada `yaw` e no tamanho `scale`, em
 * círculos: uma grade de células de até `cell` m de lado, um círculo
 * cobrindo cada uma.
 *
 * @returns {import('../vegetation/solidPlacement').Footprint[]}
 */
export function rectFootprints(box, { x, z, yaw, scale }, cell) {
  const [minX, minZ, maxX, maxZ] = box.map((value) => value * scale)
  const countX = Math.max(1, Math.ceil((maxX - minX) / cell))
  const countZ = Math.max(1, Math.ceil((maxZ - minZ) / cell))
  const sizeX = (maxX - minX) / countX
  const sizeZ = (maxZ - minZ) / countZ
  const radius = Math.hypot(sizeX, sizeZ) / 2
  const cos = Math.cos(yaw)
  const sin = Math.sin(yaw)
  const circles = []
  for (let i = 0; i < countX; i++) {
    for (let j = 0; j < countZ; j++) {
      const localX = minX + (i + 0.5) * sizeX
      const localZ = minZ + (j + 0.5) * sizeZ
      circles.push({
        x: x + localX * cos + localZ * sin,
        z: z - localX * sin + localZ * cos,
        radius,
      })
    }
  }
  return circles
}

/** A caixa no chão do modelo do LGPE `model` (`[minX, minZ, maxX, maxZ]`). */
export function modelBoxOf(model) {
  const box = LGPE_COLLIDERS[model]?.box
  if (!box) throw new Error(`modelo sem caixa no chão: ${model}`)
  return box
}

// Os quatro lados de um lote, como a direção (para fora) da rua daquele lado.
const SIDES = [
  { dx: -1, dz: 0 },
  { dx: 1, dz: 0 },
  { dx: 0, dz: -1 },
  { dx: 0, dz: 1 },
]

/** Os lados do lote `(i, j)` que dão para a rua (na borda do quarteirão). */
function streetSidesOf(i, j, lotsPerSide) {
  const last = lotsPerSide - 1
  return SIDES.filter(
    ({ dx, dz }) =>
      (dx === -1 && i === 0) ||
      (dx === 1 && i === last) ||
      (dz === -1 && j === 0) ||
      (dz === 1 && j === last),
  )
}

// O giro que leva o +Z do modelo (a frente, onde fica a porta) para `side`.
const yawFacing = ({ dx, dz }) => Math.atan2(dx, dz)

/** A casa sorteada por `roll` (0 a 1) pelos pesos. */
function pickHouse(houses, roll) {
  const total = houses.reduce((sum, { weight = 1 }) => sum + weight, 0)
  let left = roll * total
  for (const house of houses) {
    left -= house.weight ?? 1
    if (left < 0) return house
  }
  return houses.at(-1)
}

/**
 * O índice de cidades de um chunk só (sem o do mundo): o peso e a altura do
 * próprio chunk, e a busca presa nele.
 */
function chunkCityIndex(chunk, { seed, biomeList, terrain, town }) {
  return createCityIndex({
    seed,
    town,
    terrain,
    shareAt: (x, z) => townShareAt(chunk, biomeList, x, z),
    heightAt: (x, z) => chunkHeightAt(chunk, x, z),
    bounds: [
      chunk.minX,
      chunk.minZ,
      chunk.minX + chunk.size,
      chunk.minZ + chunk.size,
    ],
  })
}

/**
 * A planta da cidade no chunk: prédios e objetos de rua dos quarteirões de
 * centro dentro dele, com a pegada de todos.
 *
 * @param {import('../terrain/terrainChunk').TerrainChunk} chunk
 * @param {object} options
 * @param {number} options.seed
 * @param {object[]} options.biomeList - biomas da receita do relevo
 * @param {object} [options.terrain] - forma de `GAME_CONFIG.TERRAIN`
 * @param {import('./cityIndex').CityIndex} [options.cities] - o índice de
 *   cidades do mundo (o conjunto de chunks monta um por seed); sem ele, um
 *   preso ao chunk
 * @returns {{ buildings: import('../vegetation/solidPlacement').SolidPlacement[],
 *   footprints: import('../vegetation/solidPlacement').Footprint[] }}
 */
export function placeTown(
  chunk,
  { seed, biomeList, terrain = GAME_CONFIG.TERRAIN, cities },
) {
  const townIndex = townsOf(chunk, biomeList).findIndex(Boolean)
  if (townIndex < 0) return { buildings: [], footprints: [] }
  const town = townsOf(chunk, biomeList)[townIndex]
  const biome = chunk.biomeIds[townIndex]
  const { blockSize } = town
  const index =
    cities ?? chunkCityIndex(chunk, { seed, biomeList, terrain, town })
  const placer = createPlacer(chunk, {
    seed,
    terrain,
    town,
    biome,
    cities: index,
  })

  const firstX = Math.floor(chunk.minX / blockSize)
  const firstZ = Math.floor(chunk.minZ / blockSize)
  const lastX = Math.floor((chunk.minX + chunk.size) / blockSize)
  const lastZ = Math.floor((chunk.minZ + chunk.size) / blockSize)
  for (let blockX = firstX; blockX <= lastX; blockX++) {
    for (let blockZ = firstZ; blockZ <= lastZ; blockZ++) {
      const centerX = (blockX + 0.5) * blockSize
      const centerZ = (blockZ + 0.5) * blockSize
      if (!placer.isInsideChunk(centerX, centerZ)) continue
      placer.placeBlock(blockX, blockZ)
    }
  }
  return { buildings: placer.placed, footprints: placer.footprints }
}

/** O que `placeTown` usa para pôr um quarteirão (o estado do sorteio). */
function createPlacer(chunk, { seed, terrain, town, biome, cities }) {
  const {
    LOT_MARGIN,
    SHORE_GAP,
    SPAWN_CLEAR_RADIUS,
    FOOTPRINT_CELL,
    FENCE_INSET,
    GATE_WIDTH,
    LAMP_INSET,
    DOOR_GAP,
  } = GAME_CONFIG.TOWN
  const { OBSTACLE_MARGIN, CELL_SIZE } = GAME_CONFIG.PATHFINDING
  const { blockSize, streetWidth, lotsPerSide, setback, scale, props } = town
  const lotSize = (blockSize - streetWidth) / lotsPerSide
  // Folga da borda do chunk: a pegada e a margem dela na navegação ficam
  // dentro dele (como a dos sólidos, `borderGapOf`).
  const borderGap = OBSTACLE_MARGIN + CELL_SIZE
  const placed = []
  const footprints = []
  // O tema da cidade (sem cidade — a borda —, o primeiro).
  const themeOf = (city) => city?.theme ?? town.themes[0]

  const isInsideChunk = (x, z) =>
    x >= chunk.minX &&
    x < chunk.minX + chunk.size &&
    z >= chunk.minZ &&
    z < chunk.minZ + chunk.size
  const isWithinBorder = ({ x, z, radius }) =>
    x - radius >= chunk.minX + borderGap &&
    x + radius <= chunk.minX + chunk.size - borderGap &&
    z - radius >= chunk.minZ + borderGap &&
    z + radius <= chunk.minZ + chunk.size - borderGap
  const isCity = (x, z) =>
    cities.shareAt(x, z) >= town.minShare &&
    chunkHeightAt(chunk, x, z) >= terrain.WATER_LEVEL + SHORE_GAP
  const isClearOfSpawn = ({ x, z, radius }) =>
    Math.hypot(x, z) >= SPAWN_CLEAR_RADIUS + radius

  /**
   * Põe o modelo em `(x, z)` girado `yaw`, se cabe (dentro do chunk, longe
   * da origem, na cidade). `sink`: quanto a base desce abaixo do ponto
   * mais baixo do chão sob ela.
   */
  function put(
    kind,
    model,
    x,
    z,
    yaw,
    { sink = 0, size = scale, theme = null } = {},
  ) {
    const box = modelBoxOf(model)
    const pose = { x, z, yaw, scale: size }
    const circles = rectFootprints(box, pose, FOOTPRINT_CELL)
    const fits = circles.every(
      (circle) =>
        isWithinBorder(circle) &&
        isClearOfSpawn(circle) &&
        isCity(circle.x, circle.z),
    )
    if (!fits) return false
    const ground = Math.min(
      chunkHeightAt(chunk, x, z),
      ...circles.map((circle) => chunkHeightAt(chunk, circle.x, circle.z)),
    )
    placed.push({
      kind,
      model,
      x,
      y: ground - sink,
      z,
      yaw,
      scale: size,
      variant: 0,
      biome,
      // O tema da cidade (a view pinta o ginásio com a cor dele).
      ...(theme && { theme }),
    })
    footprints.push(...circles)
    return true
  }

  // Cerca na frente do lote, com o portão diante da porta.
  function placeFence(fence, center, side, yaw) {
    const box = modelBoxOf(fence)
    const piece = (box[2] - box[0]) * scale
    const count = Math.floor((lotSize - 2 * LOT_MARGIN) / piece)
    const along = { dx: side.dz, dz: -side.dx }
    const reach = lotSize / 2 - FENCE_INSET
    for (let k = 0; k < count; k++) {
      const offset = (k - (count - 1) / 2) * piece
      if (Math.abs(offset) < GATE_WIDTH / 2 + piece / 2) continue
      put(
        STREET_PROP_KIND,
        fence,
        center.x + side.dx * reach + along.dx * offset,
        center.z + side.dz * reach + along.dz * offset,
        yaw,
      )
    }
  }

  // Banco ao lado da porta.
  function besideDoor(model, center, side, yaw, halfWidth) {
    const front = lotSize / 2 - setback
    const along = { dx: side.dz, dz: -side.dx }
    const ahead = front + DOOR_GAP
    const beside = -Math.min(halfWidth + DOOR_GAP, lotSize / 2 - LOT_MARGIN)
    put(
      STREET_PROP_KIND,
      model,
      center.x + side.dx * ahead + along.dx * beside,
      center.z + side.dz * ahead + along.dz * beside,
      yaw,
    )
  }

  // Um lote aberto: o prédio único que a cidade pôs nele ou uma casa,
  // virado para a rua.
  function placeLot(blockX, blockZ, i, j) {
    const sides = streetSidesOf(i, j, lotsPerSide)
    if (sides.length === 0) return
    const lotX = blockX * lotsPerSide + i
    const lotZ = blockZ * lotsPerSide + j
    if (!cities.isLotOpen(lotX, lotZ)) return
    const originX = blockX * blockSize + streetWidth / 2
    const originZ = blockZ * blockSize + streetWidth / 2
    const center = {
      x: originX + (i + 0.5) * lotSize,
      z: originZ + (j + 0.5) * lotSize,
    }
    const rng = createRng(deriveSeed(seed, `town:lot:${lotX},${lotZ}`))
    const side = sides[Math.floor(rng() * sides.length)]
    const yaw = yawFacing(side)
    const roll = rng()

    const city = cities.cityOf(blockX, blockZ)
    const building =
      city?.landmarks.get(lotKey(lotX, lotZ)) ??
      pickHouse(themeOf(city).houses, roll)
    const size = building.scale ?? scale
    const [minX, minZ, maxX, maxZ] = modelBoxOf(building.model).map(
      (value) => value * size,
    )
    const halfWidth = Math.max(-minX, maxX)
    const fits =
      halfWidth <= lotSize / 2 - LOT_MARGIN &&
      maxZ - minZ <= lotSize - setback - LOT_MARGIN
    if (!fits) return
    // A frente do prédio fica a `setback` da divisa da rua.
    const front = lotSize / 2 - setback
    const x = center.x + side.dx * (front - maxZ)
    const z = center.z + side.dz * (front - maxZ)
    const isPlaced = put(BUILDING_KIND, building.model, x, z, yaw, {
      sink: town.sink,
      size,
      theme: themeOf(city).id,
    })
    if (!isPlaced) return

    if (building.fence) {
      placeFence(themeOf(city).fence ?? props.fence, center, side, yaw)
    }
    if (building.bench) {
      besideDoor(props.bench, center, side, yaw, halfWidth)
    }
  }

  // Postes nas quatro esquinas de dentro do quarteirão.
  function placeLamps(blockX, blockZ) {
    const lamp = themeOf(cities.cityOf(blockX, blockZ)).lamp ?? props.lamp
    const inner = streetWidth / 2 + LAMP_INSET
    for (const cornerX of [inner, blockSize - inner]) {
      for (const cornerZ of [inner, blockSize - inner]) {
        put(
          STREET_PROP_KIND,
          lamp,
          blockX * blockSize + cornerX,
          blockZ * blockSize + cornerZ,
          0,
        )
      }
    }
  }

  return {
    placed,
    footprints,
    isInsideChunk,
    placeBlock(blockX, blockZ) {
      for (let i = 0; i < lotsPerSide; i++) {
        for (let j = 0; j < lotsPerSide; j++) placeLot(blockX, blockZ, i, j)
      }
      placeLamps(blockX, blockZ)
    },
  }
}
