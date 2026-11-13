import { getCityLayout } from '../data/cityLayouts'
import { smoothstep } from '../math'
import { chunkHeightAt, heightIndex } from '../terrain/terrainChunk'
import {
  cityLayoutHeightAt,
  cityLayoutLakeAt,
  cityLayoutLakeRect,
  cityLayoutPaintAt,
  cityLayoutRoadDistanceAt,
  prepareCityLayout,
} from './cityLayout'
import LGPE_COLLIDERS from '../data/lgpeColliders.json'
import { getBiome } from '../data/biomes'
import { hash01 } from '../vegetation/scatter'
import {
  TREE_KIND,
  footprintOf,
  groundedBaseY,
  solidFootprintOf,
  solidParams,
} from '../vegetation/solidPlacement'
import { vegetationEntryOf } from '../vegetation/vegetationEntry'
import { DECOR_KIND, TRAINING_DUMMY_KIND, rectFootprints } from './townPlan'
import { townMapToWorld } from '../townMap/townMapPlacement'

/**
 * A primeira cidade fixa no mundo procedural (docs/features/069-revisao-do-
 * bioma-cidade.md — Viridian, a cidade inicial): no lugar da cidade
 * procedural da origem, a cidade montada à mão (`core/data/cityLayouts/`),
 * fiel ao layout de uma cidade do Let's Go, com a chegada dela (à frente do
 * Pokécenter) na origem, onde o treinador nasce. Puro e determinístico.
 *
 * - **Relevo** (`fixedTownHeight`): dentro da área (`rect`), o chão do
 *   layout (`core/town/cityLayout.js`: os nossos platôs, rampas, a nossa
 *   montanha e o lago); de lá para fora, numa faixa de `BLEND` m, vai da
 *   altura da borda até a da seed — quem pergunta a altura (o colisor, a
 *   navegação, quem nasce) pisa no chão dela.
 * - **A cidade da seed** (`citySites.js`): o raio do disco do bioma cobre
 *   a área inteira (`radius`), e ela não tem lotes nem ruas.
 * - **Saídas** (`gates`): o meio de cada vão da borda, de onde as estradas
 *   da seed saem (`roads.js`).
 * - **Objetos** (`buildings`, `trees`): postos como os das cidades
 *   procedurais — os prédios e objetos de rua com o casco do modelo e a
 *   pegada, os enfeites sem nada; as árvores como as do mundo.
 * - **Campo de treino** (`trainingField` no layout, o que a cidade original
 *   não tem): os bonecos do campo das cidades procedurais
 *   (`town.trainingField`, docs/features/067-campo-de-treino-e-avisos-de-
 *   nivel.md), em grade no meio dele e virados para a entrada; a cerca e o
 *   chão de terra vêm do layout (`props` e `ground`).
 *
 * @typedef {object} FixedTown
 * @property {string} layoutId - id em `core/data/cityLayouts/`
 * @property {string} name - como o jogo chama a cidade
 * @property {object} layout - as grades do layout (`prepareCityLayout`)
 * @property {import('./cityLayout').CityLayoutGround} ground - o relevo do
 *   layout (`FIRST_TOWN.GROUND`)
 * @property {object[]} [trees] - as árvores da montada à mão no mundo (a
 *   forma de `SolidPlacement`: a folhosa do bioma da cidade, desenhada
 *   como as do mundo)
 * @property {string[]} [grows] - os tipos de vegetação que nascem no
 *   gramado dela (`FIRST_TOWN.GROWS`)
 * @property {object[]} [buildings] - os objetos da montada à mão no mundo
 *   (a forma de `SolidPlacement`; com `grounded` — `'lowest'` ou
 *   `'center'` —, a base vai para o chão debaixo deles em
 *   `fixedTownSolidsIn`)
 * @property {object[]} [dummies] - os bonecos do campo de treino dela (a
 *   mesma forma, `TRAINING_DUMMY_KIND`)
 * @property {{ rect: number[], surface: number } | null} [lake] - o lago
 *   da montada à mão: o retângulo (m, `[minX, minZ, maxX, maxZ]`) e a
 *   altura (m) da superfície da água
 * @property {{ x: number, y: number, z: number, scale: number }} place - a
 *   origem do layout no mundo e o tamanho (a forma de `OnTownMap`)
 * @property {number[]} rect - `[minX, minZ, maxX, maxZ]` (m) da área do
 *   layout no mundo
 * @property {number} radius - m da origem até o canto mais longe da área
 * @property {number} blend - largura (m) da faixa de mistura do relevo
 * @property {{ x: number, z: number, side: string, road: string }[]} gates
 * @property {{ x: number, y: number, z: number, yaw: number }} spawn - onde
 *   o treinador nasce (a chegada do layout: a origem, no chão)
 */

/**
 * A primeira cidade fixa pela receita (`cities.FIRST_TOWN`) e o bioma da
 * cidade (`town.scale`, o tamanho dos prédios; `relief.baseHeight`, o chão
 * dela) — a montada à mão (`LAYOUT`), ou `null` sem ela (a primeira cidade
 * é a procedural).
 *
 * @param {object} options
 * @param {object} options.params - forma de `GAME_CONFIG.CITIES.FIRST_TOWN`
 * @param {object} options.townBiome - o bioma com `town`
 * @param {number} options.waterLevel - `TERRAIN.WATER_LEVEL`
 * @returns {FixedTown | null}
 */
export function createFixedTown({ params, townBiome, waterLevel }) {
  if (!params || !townBiome) return null
  // O id em `core/data/cityLayouts/` ou o próprio layout (um de teste).
  const layout =
    typeof params.LAYOUT === 'string'
      ? getCityLayout(params.LAYOUT)
      : (params.LAYOUT ?? null)
  if (!layout) return null
  return createLayoutTown({
    layout,
    params,
    scale: params.SCALE ?? townBiome.town?.scale ?? 1,
    groundLevel: waterLevel + townBiome.relief.baseHeight,
    biome: townBiome.id,
    trainingField: townBiome.town?.trainingField ?? null,
  })
}

/**
 * A cidade montada à mão (`layout`, `core/data/cityLayouts/`): a chegada
 * dela na origem, o chão do layout no chão da cidade da seed e os objetos
 * dela (`layout.props`: prédios e enfeites) no mundo. Os prédios colidem
 * pelo casco do modelo, como os das cidades procedurais.
 */
function createLayoutTown({
  layout,
  params,
  scale,
  groundLevel,
  biome,
  trainingField,
}) {
  const layoutData = prepareCityLayout(layout)
  const { arrival } = layout
  const place = {
    x: -arrival.x * scale,
    y: groundLevel,
    z: -arrival.z * scale,
    scale,
  }
  const low = townMapToWorld(place, { x: 0, z: 0 })
  const high = townMapToWorld(place, { x: layoutData.cols, z: layoutData.rows })
  const rect = [low.x, low.z, high.x, high.z]
  const gates = (layout.exits ?? []).map(({ side, road, x, z }) => ({
    side,
    road,
    ...pick(townMapToWorld(place, { x, z })),
  }))
  // Os objetos: `y` (m do layout) é a base a partir do chão da cidade;
  // sem ele, a base vai para o chão debaixo do objeto (`grounded`, quando
  // o bloco de sólidos dele é montado — o chão lá já tem a ondulação), no
  // ponto mais baixo da pegada ou, com `rest: 'center'`, no do meio. O
  // tamanho é o da cidade vezes o dele (`scale`).
  const buildings = (layout.props ?? []).map((prop) => ({
    kind: prop.kind ?? DECOR_KIND,
    model: prop.model,
    ...townMapToWorld(place, { x: prop.x, y: prop.y ?? 0, z: prop.z }),
    yaw: prop.yaw ?? 0,
    scale: scale * (prop.scale ?? 1),
    variant: 0,
    biome,
    ...(prop.y == null && { grounded: prop.rest ?? 'lowest' }),
  }))
  // As árvores: a folhosa do bioma da cidade (a do mundo, `TREE_KIND`), no
  // tamanho médio do sorteio dela vezes o do bioma e o do ponto, com o
  // modelo e o giro sorteados pelo lugar.
  const treeScale = meanTreeScale(biome)
  const trees = (layout.trees ?? []).map((tree, index) => ({
    kind: TREE_KIND,
    ...townMapToWorld(place, { x: tree.x, y: 0, z: tree.z }),
    yaw: hash01(index, 1, TREE_SALT) * Math.PI * 2,
    scale: treeScale * (tree.scale ?? 1),
    variant: hash01(index, 2, TREE_SALT),
    biome,
    grounded: true,
  }))
  const dummies = layoutDummies(layout.trainingField, trainingField, {
    place,
    biome,
  })
  // O lago: o retângulo das células dele no mundo e a superfície da água.
  const lakeCells = cityLayoutLakeRect(layoutData)
  const lakeLow =
    lakeCells && townMapToWorld(place, { x: lakeCells[0], z: lakeCells[1] })
  const lakeHigh =
    lakeCells && townMapToWorld(place, { x: lakeCells[2], z: lakeCells[3] })
  const lake = lakeCells && {
    rect: [lakeLow.x, lakeLow.z, lakeHigh.x, lakeHigh.z],
    surface: groundLevel - params.GROUND.lakeWater,
  }
  return {
    layoutId: layout.id,
    name: layout.name,
    layout: layoutData,
    ground: params.GROUND,
    place,
    rect,
    radius: radiusOf(rect),
    blend: params.BLEND,
    gates,
    spawn: { x: 0, y: groundLevel, z: 0, yaw: arrival.yaw },
    buildings,
    dummies,
    trees,
    grows: params.GROWS ?? [],
    lake,
  }
}

// Para onde fica a entrada do campo de treino do layout (`facing`).
const FACINGS = {
  north: { dx: 0, dz: -1 },
  south: { dx: 0, dz: 1 },
  west: { dx: -1, dz: 0 },
  east: { dx: 1, dz: 0 },
}

/**
 * Os bonecos do campo de treino do layout (`spot`: o meio dele, m do
 * layout, e `facing`, o lado da entrada) com os números do campo das
 * cidades procedurais (`field`, `town.trainingField`): `columns` ×
 * `rows` a `spacing` m (do mundo) um do outro, no tamanho próprio deles,
 * virados para a entrada — a mesma conta do `placeTrainingField`
 * (`townPlan.js`). Nenhum sem o campo no layout ou no bioma.
 */
function layoutDummies(spot, field, { place, biome }) {
  if (!spot || !field) return []
  const side = FACINGS[spot.facing]
  if (!side) throw new Error(`entrada do campo de treino: ${spot.facing}`)
  const center = townMapToWorld(place, { x: spot.x, y: 0, z: spot.z })
  const yaw = Math.atan2(side.dx, side.dz) + (field.turn ?? 0)
  const along = { dx: side.dz, dz: -side.dx }
  const dummies = []
  for (let column = 0; column < field.columns; column++) {
    for (let row = 0; row < field.rows; row++) {
      const across = (column - (field.columns - 1) / 2) * field.spacing
      const ahead = (row - (field.rows - 1) / 2) * field.spacing
      dummies.push({
        kind: TRAINING_DUMMY_KIND,
        model: field.dummy,
        x: center.x + along.dx * across + side.dx * ahead,
        y: center.y,
        z: center.z + along.dz * across + side.dz * ahead,
        yaw,
        scale: field.scale,
        variant: 0,
        biome,
        grounded: 'lowest',
      })
    }
  }
  return dummies
}

// Separa o sorteio das árvores da cidade montada à mão.
const TREE_SALT = 69

/** O tamanho médio de uma folhosa do bioma `biome` (o meio do sorteio). */
function meanTreeScale(biome) {
  const [min, max] = solidParams().trees.SCALE
  const entry = vegetationEntryOf(getBiome(biome), TREE_KIND)
  return ((min + max) / 2) * (entry?.scale ?? 1)
}

/** m da origem até o canto mais longe de `rect`. */
const radiusOf = ([minX, minZ, maxX, maxZ]) =>
  Math.max(
    ...[
      [minX, minZ],
      [minX, maxZ],
      [maxX, minZ],
      [maxX, maxZ],
    ].map(([x, z]) => Math.hypot(x, z)),
  )

const pick = ({ x, z }) => ({ x, z })

/** Distância (m) de `(x, z)` até a área da cidade (0 dentro dela). */
export function distanceOutside(fixedTown, x, z) {
  const [minX, minZ, maxX, maxZ] = fixedTown.rect
  const dx = Math.max(minX - x, 0, x - maxX)
  const dz = Math.max(minZ - z, 0, z - maxZ)
  return Math.hypot(dx, dz)
}

/** Se `(x, z)` cai na área da cidade (com `margin` m a mais em volta). */
export function isInsideFixedTown(fixedTown, x, z, margin = 0) {
  const [minX, minZ, maxX, maxZ] = fixedTown.rect
  return (
    x >= minX - margin &&
    x <= maxX + margin &&
    z >= minZ - margin &&
    z <= maxZ + margin
  )
}

/**
 * A altura (m, no mundo) do chão da cidade em `(x, z)`: a do layout (presa
 * na borda dele, fora da área).
 */
export function fixedTownGroundAt(fixedTown, x, z) {
  const { place } = fixedTown
  return (
    place.y +
    cityLayoutHeightAt(
      fixedTown.layout,
      fixedTown.ground,
      place.scale,
      (x - place.x) / place.scale,
      (z - place.z) / place.scale,
    )
  )
}

/**
 * A altura (m) em `(x, z)` com a cidade: dentro dela, o chão dela; na
 * faixa de `blend` m em volta, da altura da borda mais perto (o chão preso
 * nela) até `natural` (a da seed); além, `natural`. O chão do layout
 * acompanha de leve o relevo da seed (`swell`): o topo do platô nunca é
 * plano de todo, como nos biomas (docs/roadmap.md, 090).
 */
export function fixedTownHeight(fixedTown, x, z, natural) {
  const distance = distanceOutside(fixedTown, x, z)
  if (distance >= fixedTown.blend) return natural
  const swell = (natural - fixedTown.place.y) * (fixedTown.ground.swell ?? 0)
  const ground = fixedTownGroundAt(fixedTown, x, z) + swell
  const t = smoothstep(0, fixedTown.blend, distance)
  return ground + (natural - ground) * t
}

/**
 * A saída da cidade que mais dá para `(toX, toZ)` (pela direção a partir da
 * origem) — de onde sai a estrada até lá. Sem saídas, a origem.
 */
export function gateToward(fixedTown, toX, toZ) {
  if (fixedTown.gates.length === 0) return { x: 0, z: 0 }
  const length = Math.hypot(toX, toZ) || 1
  let best = null
  let bestScore = -Infinity
  for (const gate of fixedTown.gates) {
    const reach = Math.hypot(gate.x, gate.z) || 1
    const score = (gate.x * toX + gate.z * toZ) / (reach * length)
    if (score > bestScore) {
      bestScore = score
      best = gate
    }
  }
  return { x: best.x, z: best.z }
}

/**
 * Os objetos da cidade com o centro dentro do retângulo `[minX, minZ,
 * maxX, maxZ]` (um bloco de sólidos), com as pegadas deles (`buildings`,
 * os do layout e depois os bonecos do campo de treino):
 * os prédios com a pegada do modelo e, com `chunk` (o relevo do bloco), a
 * base no ponto mais baixo do chão debaixo dela (como o `put` das cidades
 * procedurais); os enfeites sem pegada. As árvores dela (`trees`), com a
 * pegada e a base das do mundo.
 */
export function fixedTownSolidsIn(
  fixedTown,
  [minX, minZ, maxX, maxZ],
  cell,
  chunk = null,
) {
  const isInside = (x, z) => x >= minX && x < maxX && z >= minZ && z < maxZ
  const landed = [...fixedTown.buildings, ...(fixedTown.dummies ?? [])]
    .filter(({ x, z }) => isInside(x, z))
    .map((building) => landBuilding(building, cell, chunk))
  const trees = fixedTown.trees
    .filter(({ x, z }) => isInside(x, z))
    .map((tree) => landTree(tree, chunk))
  return {
    footprints: [
      ...landed.flatMap(({ circles }) => circles),
      ...trees.flatMap((tree) => footprintOf(tree.kind, tree, solidParams())),
    ],
    buildings: landed.map(({ placement }) => placement),
    trees,
  }
}

/**
 * Uma árvore da montada à mão no bloco: com o relevo do bloco, a base como
 * a das árvores do mundo (`groundedBaseY`: o chão mais baixo debaixo da
 * pegada do modelo).
 */
function landTree(tree, chunk) {
  const { grounded, ...placement } = tree
  if (grounded && chunk) {
    placement.y = groundedBaseY(
      chunk,
      placement.x,
      placement.z,
      solidFootprintOf(placement, solidParams()).radius,
    )
  }
  return placement
}

/**
 * A pegada de um objeto da montada à mão: a caixa no chão do modelo
 * (`rectFootprints`) ou, sem caixa (árvore, pedra), um círculo do alcance
 * do casco (o tronco). Nenhuma no enfeite.
 */
function footprintsOf(placement, cell) {
  if (placement.kind === DECOR_KIND) return []
  const collider = LGPE_COLLIDERS[placement.model]
  if (collider?.box) return rectFootprints(collider.box, placement, cell)
  if (collider?.reach) {
    const { x, z, scale } = placement
    return [{ x, z, radius: collider.reach * scale }]
  }
  throw new Error(`modelo sem caixa nem alcance no chão: ${placement.model}`)
}

/**
 * Um objeto da montada à mão no bloco: a pegada (`footprintsOf`) e, com
 * `grounded` e o relevo do bloco, a base no chão — no ponto mais baixo
 * dele no meio e debaixo da pegada (`'lowest'`: o resto do chão fica por
 * dentro do objeto) ou no do meio (`'center'`: a moita no barranco afunda
 * do lado de cima, em vez de descer até o pé dele; o enfeite também).
 */
function landBuilding(building, cell, chunk) {
  const { grounded, ...placement } = building
  const circles = footprintsOf(placement, cell)
  if (grounded && chunk) {
    const center = chunkHeightAt(chunk, placement.x, placement.z)
    placement.y =
      grounded === 'center'
        ? center
        : Math.min(
            center,
            ...circles.map(({ x, z }) => chunkHeightAt(chunk, x, z)),
          )
  }
  return { placement, circles }
}

/**
 * A área da cidade por vértice do chunk (na ordem de `heights`): 1 dentro
 * dela (e `margin` m em volta), 0 fora — ou `null` se o chunk não a toca.
 * Vai no chão sem vegetação do chunk (`chunk.bare`).
 */
export function chunkFixedTown(chunk, fixedTown, margin = 0) {
  if (!fixedTown) return null
  const { resolution, minX, minZ, size } = chunk
  const [rMinX, rMinZ, rMaxX, rMaxZ] = fixedTown.rect
  if (
    minX > rMaxX + margin ||
    minX + size < rMinX - margin ||
    minZ > rMaxZ + margin ||
    minZ + size < rMinZ - margin
  ) {
    return null
  }
  const step = size / resolution
  const values = new Float32Array((resolution + 1) ** 2)
  let isEmpty = true
  for (let ix = 0; ix <= resolution; ix++) {
    for (let iz = 0; iz <= resolution; iz++) {
      const x = minX + ix * step
      const z = minZ + iz * step
      if (!isInsideFixedTown(fixedTown, x, z, margin)) continue
      values[iz + ix * (resolution + 1)] = 1
      isEmpty = false
    }
  }
  return isEmpty ? null : values
}

/**
 * O desenho do chão da cidade montada à mão no chunk
 * (docs/features/069-revisao-do-bioma-cidade.md): por vértice (na ordem de
 * `heights`), onde ele vale (`area`, 1 dentro da cidade), o peso de cada
 * camada de cor do chão (`weights`, `layers.length` por vértice) e a
 * camada do barranco (`cliff`, o índice em `cliffLayers`) — ou `null` se o
 * chunk não toca a cidade ou ela não tem desenho.
 *
 * @typedef {object} TownPaint
 * @property {string[]} layers - a camada de cor de cada letra do chão
 *   (`paint.ground` de agora; duas letras podem ter a mesma)
 * @property {Float32Array} weights
 * @property {string[]} cliffLayers - as camadas dos barrancos
 * @property {Uint8Array} cliff
 * @property {Float32Array} area
 * @property {TownCurb | null} curb - a beira da rua, desenhada por pixel
 *   (sem `road` no layout, `null`)
 *
 * @typedef {object} TownCurb
 * @property {string} road - a camada de cor da rua
 * @property {string} soil - a camada da borda de terra
 * @property {Float32Array} distance - por vértice, a distância até a beira
 *   da rua em larguras da faixa (`GROUND.curb.width`): positiva fora,
 *   negativa dentro, presa em `±CURB_REACH`
 * @property {Float32Array} along - por vértice, a coordenada da máscara ao
 *   longo da beira (a soma de x e z: segue a beira, que é reta em x ou z)
 *
 * @returns {TownPaint | null}
 */
export function chunkTownPaint(chunk, fixedTown) {
  const layoutData = fixedTown?.layout
  if (!layoutData?.layout.paint) return null
  const area = chunkFixedTown(chunk, fixedTown)
  if (!area) return null
  const { resolution, minX, minZ, size } = chunk
  const { place } = fixedTown
  const { paint } = layoutData.layout
  const layers = layoutData.letters.map((letter) => paint.ground[letter])
  const cliffLayers = []
  const curb = townCurbOf(layoutData, fixedTown.ground, area.length)
  const weights = new Float32Array(area.length * layers.length)
  const cliff = new Uint8Array(area.length)
  const scratch = new Float32Array(layers.length)
  const step = size / resolution
  for (let ix = 0; ix <= resolution; ix++) {
    for (let iz = 0; iz <= resolution; iz++) {
      const index = heightIndex(resolution, ix, iz)
      if (area[index] <= 0) continue
      const x = (minX + ix * step - place.x) / place.scale
      const z = (minZ + iz * step - place.z) / place.scale
      const here = cityLayoutPaintAt(
        layoutData,
        fixedTown.ground,
        place.scale,
        x,
        z,
        scratch,
      )
      weights.set(here.weights, index * layers.length)
      if (curb) {
        const { width, along } = fixedTown.ground.curb
        curb.distance[index] =
          cityLayoutRoadDistanceAt(layoutData, x, z, CURB_REACH * width) / width
        curb.along[index] = (x + z) * along
      }
      if (!here.cliff) continue
      if (!cliffLayers.includes(here.cliff)) cliffLayers.push(here.cliff)
      cliff[index] = cliffLayers.indexOf(here.cliff)
    }
  }
  return { layers, weights, cliffLayers, cliff, area, curb }
}

// Até quantas larguras da faixa a distância da beira da rua é medida (o
// resto já é rua ou lote cheio).
export const CURB_REACH = 2

/**
 * A beira da rua do layout (`layout.road`, `paint.curb`) para `count`
 * vértices — fora da cidade, longe da rua (`CURB_REACH`) — ou `null` sem
 * rua com guia.
 */
function townCurbOf(layoutData, ground, count) {
  const { layout } = layoutData
  if (!layoutData.road || !layout.paint.curb || !ground.curb) return null
  return {
    road: layout.paint.ground[layout.road],
    soil: layout.paint.curb,
    distance: new Float32Array(count).fill(CURB_REACH),
    along: new Float32Array(count),
  }
}

/**
 * A profundidade (m) da água do lago da cidade montada à mão em `(x, z)`,
 * com o chão em `groundY` (a superfície menos o chão) — ou `-Infinity`
 * fora do lago (sem água dele ali). A mesma regra dos lagos e rios do
 * mundo: quem chama soma à profundidade deles (`core/actions/water.js`,
 * `pathfinding.js`).
 */
export function fixedTownWaterDepthAt(fixedTown, x, z, groundY) {
  const lake = fixedTown?.lake
  if (!lake) return -Infinity
  const [minX, minZ, maxX, maxZ] = lake.rect
  if (x < minX || x > maxX || z < minZ || z > maxZ) return -Infinity
  const { place } = fixedTown
  const share = cityLayoutLakeAt(
    fixedTown.layout,
    (x - place.x) / place.scale,
    (z - place.z) / place.scale,
  )
  return share > 0 ? lake.surface - groundY : -Infinity
}

/**
 * Onde os tipos que nascem na cidade montada à mão (`grows`: a grama e as
 * flores do mundo) não nascem, por vértice do chunk (na ordem de
 * `heights`): fora do gramado (a letra `lawn` do layout — as ruas, a terra
 * e as pedras de pisar) e no lago. Vai no `chunk.bareOpen` (`trailAt`); os
 * outros tipos seguem sem nascer na cidade inteira (`chunk.bare`). `null`
 * sem cidade montada à mão no chunk ou sem tipos.
 *
 * @returns {{ kinds: string[], values: Float32Array } | null}
 */
export function chunkTownBareOpen(chunk, fixedTown) {
  const layoutData = fixedTown?.layout
  const kinds = fixedTown?.grows ?? []
  if (!layoutData?.layout.paint || kinds.length === 0) return null
  const area = chunkFixedTown(chunk, fixedTown)
  if (!area) return null
  const lawn = layoutData.letters.indexOf(layoutData.layout.lawn)
  const { resolution, minX, minZ, size } = chunk
  const { place } = fixedTown
  const step = size / resolution
  const weights = new Float32Array(layoutData.letters.length)
  const values = new Float32Array(area.length)
  for (let ix = 0; ix <= resolution; ix++) {
    for (let iz = 0; iz <= resolution; iz++) {
      const index = heightIndex(resolution, ix, iz)
      if (area[index] <= 0) continue
      const x = (minX + ix * step - place.x) / place.scale
      const z = (minZ + iz * step - place.z) / place.scale
      cityLayoutPaintAt(
        layoutData,
        fixedTown.ground,
        place.scale,
        x,
        z,
        weights,
      )
      const grass = lawn >= 0 ? weights[lawn] : 0
      values[index] = Math.max(1 - grass, cityLayoutLakeAt(layoutData, x, z))
    }
  }
  return { kinds, values }
}
