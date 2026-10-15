import { GAME_CONFIG } from '../gameConfig'
import { createRng, deriveSeed } from '../rng'
import { chunkHeightAt } from '../terrain/terrainChunk'
import { placeTown } from '../town/townPlan'
import { dominantBiomeAt, largestReachOf, lgpeColliderOf } from './solidModels'
import { createKindDensity, densityAt, slopeAt } from './vegetationDensity'
import { vegetationEntryOf } from './vegetationEntry'

/**
 * Os objetos SÓLIDOS da vegetação (docs/features/049-vegetacao-e-
 * floresta.md): árvores (de várias espécies) e pedras.
 * Colidem e entram no pathfinding, por isso moram no core e saem da seed
 * com o chunk. O resto da vegetação (grama, flores, arbustos, samambaias,
 * plantas, cogumelos) é só visual e mora na view.
 */

export const TREE_KIND = 'broadleaf-tree'
export const ANCIENT_TREE_KIND = 'ancient-tree'
export const PINE_KIND = 'pine-tree'
export const ACACIA_KIND = 'acacia-tree'
export const DEAD_TREE_KIND = 'dead-tree'
export const ROCK_KIND = 'rock'

/**
 * As espécies de árvore em pé, na ordem em que ocupam o chão: as grandes
 * primeiro (a árvore antiga e a acácia abrem espaço para a copa larga
 * delas), o pinheiro antes da folhosa (nos bosques dele, ele domina).
 */
export const STANDING_TREE_KINDS = [
  ANCIENT_TREE_KIND,
  ACACIA_KIND,
  PINE_KIND,
  TREE_KIND,
  DEAD_TREE_KIND,
]

// O bloco de números (`solidParams`) de cada tipo.
const SPEC_KEYS = {
  [TREE_KIND]: 'trees',
  [ANCIENT_TREE_KIND]: 'ancientTrees',
  [PINE_KIND]: 'pines',
  [ACACIA_KIND]: 'acacias',
  [DEAD_TREE_KIND]: 'deadTrees',
  [ROCK_KIND]: 'rocks',
}

/** Os números de um tipo de sólido (`GAME_CONFIG.TREES`, `ROCKS`...). */
export const specOf = (kind, params) => params[SPEC_KEYS[kind]]

const isStandingTree = (kind) => STANDING_TREE_KINDS.includes(kind)

/**
 * @typedef {object} SolidPlacement
 * @property {string} kind - o tipo (`vegetation` dos biomas)
 * @property {number} x
 * @property {number} y - chão no centro
 * @property {number} z
 * @property {number} yaw - giro (rad)
 * @property {number} scale - multiplica o modelo
 * @property {number} variant - qual modelo, 0 a 1
 * @property {string} biome - o bioma dos modelos dele (`dominantBiomeAt`,
 *   o mesmo da view)
 * @property {string} [model] - o modelo do LGPE, nos da cidade (prédios e
 *   objetos de rua, core/town/townPlan.js — o resto escolhe pelo bioma)
 * @property {string} [theme] - o tema da cidade, nos prédios (`id` de
 *   `town.themes`)
 */

/** @typedef {{ x: number, z: number, radius: number }} Footprint */

/**
 * Pegada de um objeto no chão, em círculos (colisão com os vizinhos, borda
 * do chunk e pathfinding): o tronco da árvore; a pedra.
 *
 * @returns {Footprint[]}
 */
export function footprintOf(kind, placement, params) {
  const { x, z, scale } = placement
  if (isStandingTree(kind)) {
    return [{ x, z, radius: specOf(kind, params).TRUNK_RADIUS * scale }]
  }
  return [{ x, z, radius: params.rocks.RADIUS * scale }]
}

/**
 * Folga (m) da borda do chunk sem objeto do tipo: a pegada (no maior
 * tamanho) e a margem dela na grade de navegação ficam dentro do próprio
 * chunk — a região de navegação de um chunk só precisa dos objetos dele.
 * `scaleFactor`: o maior tamanho por bioma do tipo no chunk
 * (`createScaleField`); `modelReach`: o maior alcance dos colisores do
 * LGPE do tipo no chunk (`largestReachOf`, a pegada pelo modelo).
 */
export function borderGapOf(kind, params, scaleFactor = 1, modelReach = 0) {
  const { OBSTACLE_MARGIN, CELL_SIZE } = GAME_CONFIG.PATHFINDING
  const spec = specOf(kind, params)
  const largest = { x: 0, z: 0, yaw: 0, scale: spec.SCALE[1] * scaleFactor }
  const reach = Math.max(
    modelReach * largest.scale,
    ...footprintOf(kind, largest, params).map(
      (circle) => Math.hypot(circle.x, circle.z) + circle.radius,
    ),
  )
  return reach + OBSTACLE_MARGIN + CELL_SIZE
}

/**
 * A pegada que a navegação e o sub-bosque evitam: com o modelo do LGPE, o
 * círculo que cobre o casco dele (`lgpeColliderOf`); sem, `footprintOf`.
 * O sorteio (encostar nos vizinhos, folga da borda) segue no
 * `footprintOf` — o mundo não muda com o modelo.
 *
 * @returns {Footprint}
 */
export function solidFootprintOf(solid, params) {
  const collider = lgpeColliderOf(solid)
  if (!collider) return footprintOf(solid.kind, solid, params)[0]
  return { x: solid.x, z: solid.z, radius: collider.reach * solid.scale }
}

/**
 * A altura da base do modelo de uma pedra (afundada um pouco no chão).
 */
export function rockBaseY(rock, rocks = GAME_CONFIG.ROCKS) {
  return rock.y - rocks.SINK * rocks.HEIGHT * rock.scale
}

/**
 * O tronco de uma árvore em pé (`chunk.solids.trees`) para a colisão:
 * raio e altura (m) no tamanho dela.
 */
export function trunkOf(tree, params) {
  const spec = specOf(tree.kind, params)
  return {
    radius: spec.TRUNK_RADIUS * tree.scale,
    height: spec.TRUNK_HEIGHT * tree.scale,
  }
}

// Duas pegadas se encostam (com uma folga para não nascer colado)?
const OVERLAP_GAP = 0.5
const overlaps = (a, b) =>
  a.some((p) =>
    b.some(
      (q) =>
        Math.hypot(p.x - q.x, p.z - q.z) < p.radius + q.radius + OVERLAP_GAP,
    ),
  )

// Círculo da copa de uma árvore: nenhum outro tronco dentro dele.
const crownOf = (kind, { x, z, scale }, params) => ({
  x,
  z,
  radius: specOf(kind, params).CROWN_RADIUS * scale,
})

// O tronco novo cai na copa de uma árvore já posta (`crowns`: tronco e
// copa de cada uma), ou a copa nova cobre o tronco de uma delas?
const crowdsCrowns = (trunk, crown, crowns) =>
  crowns.some(
    (other) =>
      Math.hypot(other.crown.x - trunk.x, other.crown.z - trunk.z) <
        other.crown.radius ||
      Math.hypot(other.trunk.x - crown.x, other.trunk.z - crown.z) <
        crown.radius,
  )

/**
 * O tamanho do tipo pelo bioma (`scale` da entrada do `vegetation`, 1 sem
 * ele — as pedras maiores da savana), misturado pelo peso dos biomas no
 * ponto: `at(x, z)` multiplica o tamanho sorteado; `max` é o maior do
 * chunk (a folga da borda).
 */
export function createScaleField(chunk, kind, biomeList) {
  const factors = Float32Array.from(chunk.biomeIds, (id) => {
    const biome = biomeList.find((candidate) => candidate.id === id)
    return vegetationEntryOf(biome, kind)?.scale ?? 1
  })
  if (factors.every((factor) => factor === 1)) return { max: 1, at: () => 1 }
  return {
    max: Math.max(1, ...factors),
    at: (x, z) => densityAt(chunk, factors, x, z),
  }
}

/**
 * Os objetos de um tipo num chunk, pela seed: o mundo é uma grade de
 * células de `SPACING` m; cada célula sorteia (com a própria sub-seed) um
 * ponto, o giro, o tamanho (vezes o do bioma, `createScaleField`), o
 * modelo e se ganha objeto — com chance pela densidade do tipo no lugar
 * (`createKindDensity`, com as clareiras e as manchas). A
 * célula é do mundo, não do chunk: o mesmo objeto sai igual qualquer que
 * seja o chunk que pergunte, e cada ponto cai num chunk só.
 *
 * Sem objeto: perto da água, em encosta, perto da origem (onde o treinador
 * nasce), na folga da borda (`borderGapOf`), encostado em `taken` (as
 * pegadas dos objetos já postos) e, na árvore, com o tronco na copa de
 * outra (`CROWN_RADIUS`, em `crowns`).
 */
function placeKind(
  chunk,
  kind,
  { seed, biomeList, terrain, params, taken, crowns },
) {
  const density = createKindDensity(chunk, kind, {
    biomeList,
    seed,
    clearings: params.clearings,
    patches: params.patches,
    altitude: params.altitude,
    terrain,
  })
  if (density.isEmpty) return []

  const spec = specOf(kind, params)
  const { SPACING, CHANCE, SCALE, MAX_SLOPE, SHORE_GAP } = spec
  const biomeScale = createScaleField(chunk, kind, biomeList)
  const gap = borderGapOf(
    kind,
    params,
    biomeScale.max,
    largestReachOf(kind, chunk.biomeIds),
  )
  const minX = chunk.minX + gap
  const maxX = chunk.minX + chunk.size - gap
  const minZ = chunk.minZ + gap
  const maxZ = chunk.minZ + chunk.size - gap
  const kindSeed = deriveSeed(seed, kind === TREE_KIND ? 'trees' : kind)

  const placed = []
  for (
    let cellX = Math.floor(minX / SPACING);
    cellX * SPACING < maxX;
    cellX++
  ) {
    for (
      let cellZ = Math.floor(minZ / SPACING);
      cellZ * SPACING < maxZ;
      cellZ++
    ) {
      const rng = createRng(deriveSeed(kindSeed, `${cellX},${cellZ}`))
      const x = (cellX + rng()) * SPACING
      const z = (cellZ + rng()) * SPACING
      const roll = rng()
      const yaw = rng() * Math.PI * 2
      const size = SCALE[0] + rng() * (SCALE[1] - SCALE[0])
      const variant = rng()

      const isInside = x >= minX && x < maxX && z >= minZ && z < maxZ
      if (!isInside) continue
      if (Math.hypot(x, z) < params.trees.SPAWN_CLEAR_RADIUS) continue
      if (roll >= density.at(x, z) * CHANCE) continue
      const y = chunkHeightAt(chunk, x, z)
      if (y < terrain.WATER_LEVEL + SHORE_GAP) continue
      if (slopeAt(chunk, x, z) > MAX_SLOPE) continue
      const scale = size * biomeScale.at(x, z)
      const biome = dominantBiomeAt(chunk, x, z, kind)
      const placement = { kind, x, y, z, yaw, scale, variant, biome }
      const footprint = footprintOf(kind, placement, params)
      if (overlaps(footprint, taken)) continue
      if (isStandingTree(kind)) {
        const crown = crownOf(kind, placement, params)
        if (crowdsCrowns(footprint[0], crown, crowns)) continue
        crowns.push({ trunk: footprint[0], crown })
      }

      taken.push(...footprint)
      placed.push(placement)
    }
  }
  return placed
}

/**
 * @typedef {object} ChunkSolids
 * @property {SolidPlacement[]} trees - as árvores em pé de todas as
 *   espécies (`kind` de cada uma)
 * @property {SolidPlacement[]} rocks
 * @property {SolidPlacement[]} buildings - prédios e objetos de rua das
 *   cidades (`placeTown`, docs/features/056-bioma-cidade.md)
 * @property {Footprint[]} footprints - de todos, pelo modelo
 *   (`solidFootprintOf` — pathfinding e sub-bosque)
 */

/**
 * Os objetos sólidos do chunk: a cidade primeiro (prédios e objetos de rua,
 * `placeTown`), depois árvores (na ordem de `STANDING_TREE_KINDS`) e
 * pedras, cada uma sem encostar nos de antes.
 *
 * @param {import('../terrain/terrainChunk').TerrainChunk} chunk
 * @param {object} options
 * @param {number} options.seed - seed do relevo
 * @param {object[]} options.biomeList - biomas da receita do relevo
 * @param {object} [options.terrain] - forma de `GAME_CONFIG.TERRAIN`
 * @param {object} [options.params] - `{ trees, rocks, clearings,
 *   patches, altitude }`, formas de `GAME_CONFIG.TREES`/`ROCKS`/
 *   `CLEARINGS`/`VEGETATION_PATCHES`/`VEGETATION_ALTITUDE`
 * @param {import('../town/cityIndex').CityIndex} [options.cities] - o
 *   índice de cidades do mundo (`placeTown`)
 * @returns {ChunkSolids}
 */
export function placeChunkSolids(
  chunk,
  {
    seed,
    biomeList,
    terrain = GAME_CONFIG.TERRAIN,
    params = solidParams(),
    cities,
  },
) {
  const town = placeTown(chunk, { seed, biomeList, terrain, cities })
  const taken = [...town.footprints]
  const crowns = []
  const options = { seed, biomeList, terrain, params, taken, crowns }
  const trees = STANDING_TREE_KINDS.flatMap((kind) =>
    placeKind(chunk, kind, options),
  )
  const rocks = placeKind(chunk, ROCK_KIND, options)
  const footprints = [
    ...town.footprints,
    ...[...trees, ...rocks].map((solid) => solidFootprintOf(solid, params)),
  ]
  return { trees, rocks, buildings: town.buildings, footprints }
}

/** Os números dos objetos sólidos agora (`GAME_CONFIG`). */
export function solidParams() {
  const { TREES, ANCIENT_TREES, PINES, ACACIAS, DEAD_TREES, ROCKS } =
    GAME_CONFIG
  return {
    trees: TREES,
    ancientTrees: ANCIENT_TREES,
    pines: PINES,
    acacias: ACACIAS,
    deadTrees: DEAD_TREES,
    rocks: ROCKS,
    clearings: GAME_CONFIG.CLEARINGS,
    patches: GAME_CONFIG.VEGETATION_PATCHES,
    altitude: GAME_CONFIG.VEGETATION_ALTITUDE,
  }
}
