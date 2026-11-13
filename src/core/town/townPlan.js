import LGPE_COLLIDERS from '../data/lgpeColliders.json'
import { GAME_CONFIG } from '../gameConfig'
import { smoothstep } from '../math'
import { createRng, deriveSeed } from '../rng'
import { chunkHeightAt } from '../terrain/terrainChunk'
import { densityAt } from '../vegetation/vegetationDensity'
import { createCityIndex, lotBoundsOf, lotKey } from './cityIndex'

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
 *   banco ao lado da porta dos prédios que pedem. No tamanho próprio deles
 *   (`town.propScale`), à parte do dos prédios (`town.scale`).
 * - **Detalhes** (docs/features/069-revisao-do-bioma-cidade.md), cada um
 *   com a chance dele (`town.details`): o quintal das casas (caminho de
 *   pedras da porta até a rua, floreira e vaso encostados na frente, caixa
 *   de correio perto da rua e, ao lado da casa, o objeto do tema —
 *   `theme.yard`), hidrantes perto das esquinas e as árvores de rua nas
 *   divisas dos lotes (`treeSpots`: só os pontos — quem põe a árvore é o
 *   `placeChunkSolids`, como as outras).
 * - **Praça**: um dos prédios únicos (`plaza`) não é prédio — o lote ganha
 *   a fonte no meio, bancos virados para ela, canteiros nos cantos e o chão
 *   calçado com a rua da cidade (`chunkPlazas`).
 * - **Campo de treino** (docs/features/067-campo-de-treino-e-avisos-de-
 *   nivel.md): um dos prédios únicos não é prédio — o lote dele ganha cerca
 *   nos quatro lados (a entrada de frente para a rua), os bonecos de treino
 *   (`TRAINING_DUMMY_KIND`) em grade e o chão de terra
 *   (`chunkTrainingFields`).
 *
 * Tudo é sólido (`SolidPlacement` com `model`, o id do LGPE): colide pelo
 * casco do modelo (`lgpeColliders.json`) e a pegada é a caixa dele em
 * círculos (`rectFootprints`). Determinístico: mesma seed, mesmos lotes,
 * qualquer que seja o chunk que pergunte.
 */

export const BUILDING_KIND = 'building'
export const STREET_PROP_KIND = 'street-prop'
export const TRAINING_DUMMY_KIND = 'training-dummy'
// Enfeite chato do chão (as pedras de caminho): sem colisão nem pegada.
export const DECOR_KIND = 'street-decor'

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
 * chunk não tem rua. Com `sites` (`citySites.js`), a cidade fixa não tem
 * rua (docs/features/069-revisao-do-bioma-cidade.md — o mapa dela é a
 * cidade toda).
 */
export function chunkStreets(chunk, { biomeList, sites = null }) {
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
      if (sites?.nearestCity(x, z).city.fixed) continue
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
 * Os lotes (`[minX, minZ, maxX, maxZ]`) dos prédios únicos que passam em
 * `isWanted` (o campo de treino, a praça) nos quarteirões que encostam no
 * retângulo `bounds`, pelo índice de cidades.
 */
function landmarkLots(town, cities, [minX, minZ, maxX, maxZ], isWanted) {
  const { blockSize, lotsPerSide } = town
  const lots = []
  for (
    let blockX = Math.floor(minX / blockSize);
    blockX <= Math.floor(maxX / blockSize);
    blockX++
  ) {
    for (
      let blockZ = Math.floor(minZ / blockSize);
      blockZ <= Math.floor(maxZ / blockSize);
      blockZ++
    ) {
      const city = cities.cityOf(blockX, blockZ)
      if (!city) continue
      for (let i = 0; i < lotsPerSide; i++) {
        for (let j = 0; j < lotsPerSide; j++) {
          const lotX = blockX * lotsPerSide + i
          const lotZ = blockZ * lotsPerSide + j
          const landmark = city.landmarks.get(lotKey(lotX, lotZ))
          if (!landmark || !isWanted(landmark)) continue
          lots.push(lotBoundsOf(town, lotX, lotZ))
        }
      }
    }
  }
  return lots
}

/**
 * Força do chão dos lotes `isWanted` por vértice do chunk (na ordem de
 * `heights`), ou `null` se nenhum encosta nele: de `ground.groundInset` m
 * para dentro da divisa do lote, em `ground.groundEdge` m.
 */
function chunkLotGround(chunk, { biomeList, cities }, groundOf, isWanted) {
  const town = townsOf(chunk, biomeList).find(Boolean)
  const ground = town && groundOf(town)
  if (!ground || !cities) return null
  const { resolution, minX, minZ, size } = chunk
  const lots = landmarkLots(
    town,
    cities,
    [minX, minZ, minX + size, minZ + size],
    isWanted,
  )
  if (lots.length === 0) return null
  const step = size / resolution
  const values = new Float32Array(chunk.heights.length)
  let isEmpty = true
  for (let ix = 0; ix <= resolution; ix++) {
    for (let iz = 0; iz <= resolution; iz++) {
      const x = minX + ix * step
      const z = minZ + iz * step
      let strength = 0
      for (const [x0, z0, x1, z1] of lots) {
        const inside = Math.min(x - x0, x1 - x, z - z0, z1 - z)
        const depth = inside - ground.groundInset
        if (depth <= 0) continue
        strength = Math.max(strength, smoothstep(0, ground.groundEdge, depth))
      }
      if (strength <= 0) continue
      values[iz + ix * (resolution + 1)] = strength
      isEmpty = false
    }
  }
  return isEmpty ? null : values
}

/**
 * Força do chão de terra dos campos de treino por vértice do chunk (na
 * ordem de `heights`), ou `null` se nenhum campo encosta nele. Vai no canal
 * das estradas (o chão pinta a terra delas) e no das trilhas (a vegetação
 * não nasce nele): de `groundInset` m para dentro da divisa do lote, em
 * `groundEdge` m.
 *
 * @param {import('../terrain/terrainChunk').TerrainChunk} chunk
 * @param {object} options
 * @param {object[]} options.biomeList
 * @param {import('./cityIndex').CityIndex | null} options.cities - o índice
 *   de cidades do mundo
 */
export function chunkTrainingFields(chunk, options) {
  return chunkLotGround(
    chunk,
    options,
    (town) => town.trainingField,
    (landmark) => landmark.field,
  )
}

/**
 * Força do chão calçado das praças (docs/features/069-revisao-do-bioma-
 * cidade.md) por vértice do chunk, ou `null` se nenhuma encosta nele. Vai
 * no canal das ruas (o chão pinta o calçamento da cidade) e no das trilhas
 * (a vegetação não nasce nele), como o chão do campo de treino.
 *
 * @param {import('../terrain/terrainChunk').TerrainChunk} chunk
 * @param {object} options
 * @param {object[]} options.biomeList
 * @param {import('./cityIndex').CityIndex | null} options.cities
 */
export function chunkPlazas(chunk, options) {
  return chunkLotGround(
    chunk,
    options,
    (town) => town.plaza,
    (landmark) => landmark.plaza,
  )
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
 *   footprints: import('../vegetation/solidPlacement').Footprint[],
 *   treeSpots: TreeSpot[] }}
 */
export function placeTown(
  chunk,
  { seed, biomeList, terrain = GAME_CONFIG.TERRAIN, cities },
) {
  const townIndex = townsOf(chunk, biomeList).findIndex(Boolean)
  if (townIndex < 0) return { buildings: [], footprints: [], treeSpots: [] }
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
  return {
    buildings: placer.placed,
    footprints: placer.footprints,
    treeSpots: placer.treeSpots,
  }
}

/**
 * Um ponto de árvore de rua (docs/features/069-revisao-do-bioma-cidade.md):
 * o lugar, o giro e os sorteios do tamanho (`roll`, 0 a 1) e do modelo
 * (`variant`). Quem põe a árvore (ou não, se encosta em outra coisa) é o
 * `placeChunkSolids`.
 *
 * @typedef {{ x: number, z: number, yaw: number, roll: number,
 *   variant: number }} TreeSpot
 */

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
    DOOR_CLEAR,
    YARD_GAP,
    YARD_SLIDE,
    HYDRANT_GAP,
  } = GAME_CONFIG.TOWN
  const { OBSTACLE_MARGIN, CELL_SIZE } = GAME_CONFIG.PATHFINDING
  const {
    blockSize,
    streetWidth,
    lotsPerSide,
    setback,
    scale,
    propScale = scale,
    props,
    details = {},
  } = town
  const lotSize = (blockSize - streetWidth) / lotsPerSide
  // Folga da borda do chunk: a pegada e a margem dela na navegação ficam
  // dentro dele (como a dos sólidos, `borderGapOf`).
  const borderGap = OBSTACLE_MARGIN + CELL_SIZE
  const placed = []
  const footprints = []
  const treeSpots = []
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
  // Na cidade fixa (069), nada da planta: o mapa dela é a cidade toda.
  const isCity = (x, z) =>
    !cities.isFixedAt?.(x, z) &&
    cities.shareAt(x, z) >= town.minShare &&
    chunkHeightAt(chunk, x, z) >= terrain.WATER_LEVEL + SHORE_GAP
  const isClearOfSpawn = ({ x, z, radius }) =>
    Math.hypot(x, z) >= SPAWN_CLEAR_RADIUS + radius

  // Algum círculo encosta numa pegada já posta?
  const touchesPlaced = (circles) =>
    circles.some((circle) =>
      footprints.some(
        (other) =>
          Math.hypot(circle.x - other.x, circle.z - other.z) <
          circle.radius + other.radius,
      ),
    )

  /**
   * Põe o modelo em `(x, z)` girado `yaw`, se cabe (dentro do chunk, longe
   * da origem, na cidade; com `avoid`, sem encostar no que já foi posto).
   * `sink`: quanto a base desce abaixo do ponto mais baixo do chão sob
   * ela (com `onHighest`, do mais alto — a fonte, cuja água cobre o fundo
   * inteiro). `size`: o tamanho (o dos objetos de rua, sem ele).
   */
  function put(
    kind,
    model,
    x,
    z,
    yaw,
    {
      sink = 0,
      size = propScale,
      theme = null,
      avoid = false,
      onHighest = false,
    } = {},
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
    if (avoid && touchesPlaced(circles)) return false
    const heights = [
      chunkHeightAt(chunk, x, z),
      ...circles.map((circle) => chunkHeightAt(chunk, circle.x, circle.z)),
    ]
    const ground = onHighest ? Math.max(...heights) : Math.min(...heights)
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

  // Um enfeite chato do chão (`DECOR_KIND`): sem colisão nem pegada, no
  // chão do ponto.
  function putDecor(model, x, z, yaw, size) {
    const isOpen =
      isInsideChunk(x, z) && isCity(x, z) && isClearOfSpawn({ x, z, radius: 0 })
    if (!isOpen) return
    placed.push({
      kind: DECOR_KIND,
      model,
      x,
      y: chunkHeightAt(chunk, x, z),
      z,
      yaw,
      scale: size,
      variant: 0,
      biome,
    })
  }

  // Uma fileira de cerca no lado `side` do lote, a `inset` m da divisa,
  // virada para fora; com `gate` (m), o vão do portão no meio.
  function placeFenceLine(fence, center, side, { inset, gate = 0 }) {
    const box = modelBoxOf(fence)
    const piece = (box[2] - box[0]) * propScale
    const count = Math.floor((lotSize - 2 * LOT_MARGIN) / piece)
    const along = { dx: side.dz, dz: -side.dx }
    const reach = lotSize / 2 - inset
    const yaw = yawFacing(side)
    for (let k = 0; k < count; k++) {
      const offset = (k - (count - 1) / 2) * piece
      if (gate > 0 && Math.abs(offset) < gate / 2 + piece / 2) continue
      put(
        STREET_PROP_KIND,
        fence,
        center.x + side.dx * reach + along.dx * offset,
        center.z + side.dz * reach + along.dz * offset,
        yaw,
      )
    }
  }

  // O campo de treino: cerca nos quatro lados (a entrada no lado da rua) e
  // os bonecos em grade, virados para a entrada.
  function placeTrainingField(center, side, city) {
    const field = town.trainingField
    if (!field) return
    const fence = themeOf(city).fence ?? props.fence
    for (const fenceSide of SIDES) {
      placeFenceLine(fence, center, fenceSide, {
        inset: field.fenceInset,
        gate: fenceSide === side ? field.gateWidth : 0,
      })
    }
    const yaw = yawFacing(side) + (field.turn ?? 0)
    const along = { dx: side.dz, dz: -side.dx }
    for (let column = 0; column < field.columns; column++) {
      for (let row = 0; row < field.rows; row++) {
        const across = (column - (field.columns - 1) / 2) * field.spacing
        const ahead = (row - (field.rows - 1) / 2) * field.spacing
        put(
          TRAINING_DUMMY_KIND,
          field.dummy,
          center.x + along.dx * across + side.dx * ahead,
          center.z + along.dz * across + side.dz * ahead,
          yaw,
          { size: field.scale },
        )
      }
    }
  }

  // O ponto `ahead` m para o lado da rua e `across` m para o lado (o +X
  // do prédio virado para ela) a partir do meio do lote.
  const lotPoint = (center, side, ahead, across) => ({
    x: center.x + side.dx * ahead + side.dz * across,
    z: center.z + side.dz * ahead - side.dx * across,
  })

  // O retângulo `[ahead0, across0, ahead1, across1]` do modelo no lote,
  // com o meio em `(ahead, across)`, virado para a rua.
  function yardRectOf(model, size, ahead, across) {
    const [minX, minZ, maxX, maxZ] = modelBoxOf(model).map(
      (value) => value * size,
    )
    return [ahead + minZ, across + minX, ahead + maxZ, across + maxX]
  }
  const rectsTouch = (a, b) =>
    a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3]

  /**
   * O quintal de uma casa (docs/features/069-revisao-do-bioma-cidade.md),
   * cada coisa com a chance dela (`town.details`): na frente, a caixa de
   * correio perto da rua, de um lado do caminho; a floreira encostada na
   * parede do outro lado da porta e o vaso do mesmo lado da caixa; ao lado
   * da casa, o objeto do tema (`theme.yard`); por último, as pedras do
   * caminho da porta até a rua. O que não cabe (encosta na casa, no
   * corredor da porta, na cerca ou em outra coisa do quintal, ou sai do
   * lote) escorrega para fora até caber, ou fica de fora.
   */
  function placeYard(center, side, house, rng, theme) {
    const edge = lotSize / 2
    const limit = edge - LOT_MARGIN
    const yaw = yawFacing(side)
    const { front, depth, halfWidth, fenced } = house
    // O que já ocupa o lote: a casa, o corredor da porta até a rua e a
    // cerca (sem o portão).
    const taken = [
      [front - depth, -halfWidth, front, halfWidth],
      [front, -DOOR_CLEAR, edge, DOOR_CLEAR],
    ]
    if (fenced) {
      const line = edge - FENCE_INSET
      const gate = GATE_WIDTH / 2
      taken.push(
        [line - YARD_GAP, -edge, line + YARD_GAP, -gate],
        [line - YARD_GAP, gate, line + YARD_GAP, edge],
      )
    }

    // Os sorteios, sempre na mesma ordem (a mesma casa, o mesmo quintal).
    const sign = rng() < 0.5 ? -1 : 1
    const has = (key) => rng() < (details[key] ?? 0)
    const hasMailbox = has('mailbox')
    const hasPlanter = has('planter')
    const hasPot = has('pot')
    const hasPath = has('path')
    const extras = (theme.yard ?? []).filter(({ chance = 0 }) => rng() < chance)
    const extraSign = rng() < 0.5 ? -1 : 1

    // O modelo com o lado de dentro a `from` m do meio do lote (para o
    // lado `toward`), escorregando para fora até caber ou passar de
    // `reach` m do meio.
    function tryPut(model, ahead, toward, from, reach) {
      const [minX, , maxX] = modelBoxOf(model).map((value) => value * propScale)
      for (let inner = from; ; inner += YARD_SLIDE) {
        const across = toward > 0 ? inner - minX : -inner - maxX
        const rect = yardRectOf(model, propScale, ahead, across)
        const isOut =
          Math.max(Math.abs(rect[1]), Math.abs(rect[3])) > reach ||
          rect[2] > edge
        if (isOut) return
        if (taken.some((other) => rectsTouch(other, rect))) continue
        const point = lotPoint(center, side, ahead, across)
        if (!put(STREET_PROP_KIND, model, point.x, point.z, yaw)) return
        taken.push(rect)
        return
      }
    }
    // Encostado na parede da frente / perto da rua (dentro da cerca).
    const byWall = (model) =>
      front + YARD_GAP - modelBoxOf(model)[1] * propScale
    const byStreet = (model) =>
      edge -
      (fenced ? FENCE_INSET + YARD_GAP : YARD_GAP) -
      modelBoxOf(model)[3] * propScale

    if (hasMailbox && props.mailbox) {
      tryPut(props.mailbox, byStreet(props.mailbox), -sign, DOOR_CLEAR, limit)
    }
    if (hasPlanter && props.planter) {
      tryPut(props.planter, byWall(props.planter), sign, DOOR_CLEAR, halfWidth)
    }
    if (hasPot && props.pot) {
      tryPut(props.pot, byWall(props.pot), -sign, DOOR_CLEAR, halfWidth)
    }
    for (const { model } of extras) {
      const ahead = front - modelBoxOf(model)[3] * propScale
      tryPut(model, ahead, extraSign, halfWidth + YARD_GAP, limit)
    }
    if (hasPath && props.stone) placePath(center, side, front, rng)
  }

  // As pedras do caminho, da frente da casa até a rua, no meio do
  // corredor da porta, cada uma um pouco torta e fora da linha.
  function placePath(center, side, front, rng) {
    const { pathStep, stoneScale = 1 } = details
    if (!pathStep) return
    const edge = lotSize / 2
    const count = Math.floor((edge - front) / pathStep)
    const length = (edge - front) / Math.max(count, 1)
    const wander = DOOR_CLEAR / 2
    for (let k = 0; k < count; k++) {
      const across = (rng() - 0.5) * wander
      const yaw = rng() * Math.PI * 2
      const point = lotPoint(center, side, front + (k + 0.5) * length, across)
      putDecor(props.stone, point.x, point.z, yaw, propScale * stoneScale)
    }
  }

  // A praça (docs/features/069-revisao-do-bioma-cidade.md): a fonte no
  // meio, um banco de cada lado virado para ela e um canteiro em cada
  // canto. O chão calçado sai do terreno (`chunkPlazas`).
  function placePlaza(center, side) {
    const { plaza } = town
    if (!plaza) return
    const yaw = yawFacing(side)
    put(STREET_PROP_KIND, props.fountain, center.x, center.z, yaw, {
      size: propScale * plaza.fountainScale,
      sink: plaza.fountainSink ?? 0,
      onHighest: true,
    })
    for (const around of SIDES) {
      put(
        STREET_PROP_KIND,
        props.bench,
        center.x + around.dx * plaza.benchRing,
        center.z + around.dz * plaza.benchRing,
        yawFacing({ dx: -around.dx, dz: -around.dz }),
      )
    }
    for (const cornerX of [-1, 1]) {
      for (const cornerZ of [-1, 1]) {
        put(
          STREET_PROP_KIND,
          props.flowerBed,
          center.x + cornerX * plaza.bedOffset,
          center.z + cornerZ * plaza.bedOffset,
          yaw,
          { size: propScale * plaza.bedScale },
        )
      }
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
    if (building.field) {
      placeTrainingField(center, side, city)
      return
    }
    if (building.plaza) {
      placePlaza(center, side)
      return
    }
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
      placeFenceLine(themeOf(city).fence ?? props.fence, center, side, {
        inset: FENCE_INSET,
        gate: GATE_WIDTH,
      })
    }
    if (building.bench) {
      besideDoor(props.bench, center, side, yaw, halfWidth)
    }
    // Só as casas têm quintal (os prédios únicos têm o banco).
    const isHouse = !city?.landmarks.has(lotKey(lotX, lotZ))
    if (isHouse) {
      const house = {
        front,
        depth: maxZ - minZ,
        halfWidth,
        fenced: building.fence,
      }
      placeYard(center, side, house, rng, themeOf(city))
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

  // Hidrantes (docs/features/069-revisao-do-bioma-cidade.md): cada
  // esquina de dentro do quarteirão tem a chance de um, a `HYDRANT_GAP` m
  // do poste ao longo de uma das duas ruas, sem encostar em nada.
  function placeHydrants(blockX, blockZ, rng) {
    const inner = streetWidth / 2 + LAMP_INSET
    for (const cornerX of [inner, blockSize - inner]) {
      for (const cornerZ of [inner, blockSize - inner]) {
        const hasHydrant = rng() < (details.hydrants ?? 0)
        const alongX = rng() < 0.5
        if (!hasHydrant || !props.hydrant) continue
        const inwardX = cornerX < blockSize / 2 ? 1 : -1
        const inwardZ = cornerZ < blockSize / 2 ? 1 : -1
        put(
          STREET_PROP_KIND,
          props.hydrant,
          blockX * blockSize + cornerX + (alongX ? inwardX * HYDRANT_GAP : 0),
          blockZ * blockSize + cornerZ + (alongX ? 0 : inwardZ * HYDRANT_GAP),
          0,
          { avoid: true },
        )
      }
    }
  }

  // Os pontos das árvores de rua (docs/features/069-revisao-do-bioma-
  // cidade.md): nas divisas entre os lotes de cada lado do quarteirão, a
  // `treeInset` m da rua, cada um com a chance `details.streetTrees`.
  function placeTreeSpots(blockX, blockZ, rng) {
    const near = streetWidth / 2 + (details.treeInset ?? 0)
    const far = blockSize - near
    for (let k = 1; k < lotsPerSide; k++) {
      const along = streetWidth / 2 + k * lotSize
      for (const [localX, localZ] of [
        [near, along],
        [far, along],
        [along, near],
        [along, far],
      ]) {
        const spot = {
          x: blockX * blockSize + localX,
          z: blockZ * blockSize + localZ,
          yaw: rng() * Math.PI * 2,
          roll: rng(),
          variant: rng(),
        }
        const hasTree = rng() < (details.streetTrees ?? 0)
        if (!hasTree || !isCity(spot.x, spot.z)) continue
        treeSpots.push(spot)
      }
    }
  }

  return {
    placed,
    footprints,
    treeSpots,
    isInsideChunk,
    placeBlock(blockX, blockZ) {
      for (let i = 0; i < lotsPerSide; i++) {
        for (let j = 0; j < lotsPerSide; j++) placeLot(blockX, blockZ, i, j)
      }
      placeLamps(blockX, blockZ)
      const rng = createRng(deriveSeed(seed, `town:block:${blockX},${blockZ}`))
      placeHydrants(blockX, blockZ, rng)
      placeTreeSpots(blockX, blockZ, rng)
    },
  }
}
