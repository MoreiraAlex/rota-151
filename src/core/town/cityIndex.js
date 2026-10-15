import { GAME_CONFIG } from '../gameConfig'
import { createRng, deriveSeed } from '../rng'

/**
 * Quais lotes são de qual cidade (docs/features/056-bioma-cidade.md). A
 * cidade é uma mancha de bioma, sem nome nem centro no mapa; aqui ela vira
 * um conjunto de quarteirões vizinhos (lado com lado) que têm algum lote
 * aberto (`isLotOpen`: o lote inteiro no bioma da cidade, em terra seca e
 * longe da origem). Cada cidade tem:
 *
 * - um **id** — o da cidade da seed (`sites`, core/town/citySites.js,
 *   docs/features/058-ajuste-dos-biomas.md) mais perto dela; sem `sites`, o
 *   quarteirão de menor coordenada dela — o mesmo qualquer que seja o
 *   quarteirão que perguntou;
 * - um **porte** (`size`, de `town.sizes`, o da cidade da seed; sem
 *   `sites`, `null`): decide quais prédios únicos ela tem;
 * - um **tema** (`town.themes`, sorteado pela seed e pelo id): as casas, o
 *   prédio especial e a rua de uma cidade de Kanto;
 * - os **prédios únicos** (os de `town.landmarks` que o porte pede —
 *   `size.landmarks` — e o especial do tema se ele pedir, `size.special`;
 *   sem porte, todos), um de cada, nos lotes abertos mais perto do meio
 *   dela (sorteados entre os `centralLots` mais centrais, pela seed e pelo
 *   id) — numa cidade com pelo menos `TOWN.MIN_CITY_LOTS` lotes abertos;
 *   abaixo disso (lascas na borda da mancha), só casas.
 *
 * O mapa vem de fora (`shareAt`: o peso da cidade em qualquer ponto;
 * `heightAt`: a altura do relevo), então a resposta não depende de chunk
 * carregado: o conjunto de chunks monta um índice por seed (e por receita)
 * e guarda as cidades já achadas. `bounds` (opcional) limita a busca a um
 * retângulo — quando o mapa só vale nele (os testes de um chunk só).
 *
 * @typedef {object} City
 * @property {string} id
 * @property {object | null} size - a entrada de `town.sizes` da cidade
 * @property {object} theme - a entrada de `town.themes` da cidade
 * @property {Map<string, object>} landmarks - chave do lote → prédio único
 *   que fica nele (de `town.landmarks` ou o `special` do tema)
 *
 * @typedef {object} CityIndex
 * @property {object} town - o `town` do bioma
 * @property {(x: number, z: number) => number} shareAt
 * @property {(lotX: number, lotZ: number) => boolean} isLotOpen
 * @property {(blockX: number, blockZ: number) => City | null} cityOf
 * @property {(x: number, z: number) => object | null} themeNear - o tema
 *   da cidade do quarteirão de `(x, z)` ou de um vizinho dele (a rua da
 *   borda fica fora dos quarteirões da cidade)
 */

export const lotKey = (lotX, lotZ) => `${lotX},${lotZ}`
const blockKey = (blockX, blockZ) => `${blockX},${blockZ}`
const NEIGHBORS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
]

/** O retângulo `[minX, minZ, maxX, maxZ]` (m) do lote `(lotX, lotZ)`. */
export function lotBoundsOf(town, lotX, lotZ) {
  const { blockSize, streetWidth, lotsPerSide } = town
  const lotSize = (blockSize - streetWidth) / lotsPerSide
  const blockX = Math.floor(lotX / lotsPerSide)
  const blockZ = Math.floor(lotZ / lotsPerSide)
  const minX =
    blockX * blockSize +
    streetWidth / 2 +
    (lotX - blockX * lotsPerSide) * lotSize
  const minZ =
    blockZ * blockSize +
    streetWidth / 2 +
    (lotZ - blockZ * lotsPerSide) * lotSize
  return [minX, minZ, minX + lotSize, minZ + lotSize]
}

/**
 * @param {object} options
 * @param {number} options.seed
 * @param {object} options.town - o `town` do bioma da cidade
 * @param {(x: number, z: number) => number} options.shareAt - peso (0 a 1)
 *   da cidade em `(x, z)`
 * @param {(x: number, z: number) => number} options.heightAt
 * @param {object} [options.terrain] - forma de `GAME_CONFIG.TERRAIN`
 * @param {number[]} [options.bounds] - `[minX, minZ, maxX, maxZ]` onde a
 *   busca vale (sem ele, o mundo todo)
 * @param {import('./citySites').CitySites} [options.sites] - as cidades da
 *   seed (o id e o porte de cada cidade)
 * @returns {CityIndex}
 */
export function createCityIndex({
  seed,
  town,
  shareAt,
  heightAt,
  terrain = GAME_CONFIG.TERRAIN,
  bounds = null,
  sites = null,
}) {
  const {
    LOT_MARGIN,
    SHORE_GAP,
    SPAWN_CLEAR_RADIUS,
    MAX_CITY_BLOCKS,
    MIN_CITY_LOTS,
  } = GAME_CONFIG.TOWN
  const { lotsPerSide } = town
  const openLots = new Map()
  const cities = new Map()

  const isInsideBounds = (x, z) =>
    !bounds ||
    (x >= bounds[0] && x <= bounds[2] && z >= bounds[1] && z <= bounds[3])

  // O lote inteiro (os cantos, com a folga, e o meio) na cidade e em terra
  // seca, e longe da origem.
  function isLotOpen(lotX, lotZ) {
    const key = lotKey(lotX, lotZ)
    if (openLots.has(key)) return openLots.get(key)
    const [minX, minZ, maxX, maxZ] = lotBoundsOf(town, lotX, lotZ)
    const centerX = (minX + maxX) / 2
    const centerZ = (minZ + maxZ) / 2
    const points = [
      [centerX, centerZ],
      [minX + LOT_MARGIN, minZ + LOT_MARGIN],
      [minX + LOT_MARGIN, maxZ - LOT_MARGIN],
      [maxX - LOT_MARGIN, minZ + LOT_MARGIN],
      [maxX - LOT_MARGIN, maxZ - LOT_MARGIN],
    ]
    const halfDiagonal = Math.hypot(maxX - minX, maxZ - minZ) / 2
    const isOpen =
      Math.hypot(centerX, centerZ) >= SPAWN_CLEAR_RADIUS + halfDiagonal &&
      points.every(
        ([x, z]) =>
          isInsideBounds(x, z) &&
          shareAt(x, z) >= town.minShare &&
          heightAt(x, z) >= terrain.WATER_LEVEL + SHORE_GAP,
      )
    openLots.set(key, isOpen)
    return isOpen
  }

  // Os lotes abertos do quarteirão.
  function openLotsOf(blockX, blockZ) {
    const lots = []
    for (let i = 0; i < lotsPerSide; i++) {
      for (let j = 0; j < lotsPerSide; j++) {
        const lotX = blockX * lotsPerSide + i
        const lotZ = blockZ * lotsPerSide + j
        if (isLotOpen(lotX, lotZ)) lots.push([lotX, lotZ])
      }
    }
    return lots
  }

  // Os quarteirões da cidade de `(blockX, blockZ)` (vizinhos lado com lado
  // com lote aberto), em ordem de achados.
  function floodFrom(blockX, blockZ) {
    const found = [[blockX, blockZ]]
    const seen = new Set([blockKey(blockX, blockZ)])
    for (let i = 0; i < found.length && found.length < MAX_CITY_BLOCKS; i++) {
      const [x, z] = found[i]
      for (const [dx, dz] of NEIGHBORS) {
        const key = blockKey(x + dx, z + dz)
        if (seen.has(key)) continue
        seen.add(key)
        if (openLotsOf(x + dx, z + dz).length > 0) found.push([x + dx, z + dz])
      }
    }
    return found
  }

  // O tema da cidade, pelos pesos.
  function themeOf(id) {
    const { themes } = town
    const roll = createRng(deriveSeed(seed, `town:theme:${id}`))()
    const total = themes.reduce((sum, { weight = 1 }) => sum + weight, 0)
    let left = roll * total
    for (const theme of themes) {
      left -= theme.weight ?? 1
      if (left < 0) return theme
    }
    return themes.at(-1)
  }

  // Os prédios únicos que a cidade tem: os que o porte pede (sem porte,
  // todos) e o especial do tema.
  function landmarkListOf(size, theme) {
    if (!size) return [...town.landmarks, theme.special].filter(Boolean)
    return [
      ...town.landmarks.filter(({ model }) => size.landmarks.includes(model)),
      size.special ? theme.special : null,
    ].filter(Boolean)
  }

  // Os prédios únicos nos lotes mais centrais da cidade.
  function landmarksOf(id, lots, theme, size) {
    // Lasca da borda da mancha: só casas.
    if (lots.length < MIN_CITY_LOTS) return new Map()
    const centerX = lots.reduce((sum, [x]) => sum + x, 0) / lots.length
    const centerZ = lots.reduce((sum, [, z]) => sum + z, 0) / lots.length
    const byCenter = [...lots].sort(
      (a, b) =>
        Math.hypot(a[0] - centerX, a[1] - centerZ) -
          Math.hypot(b[0] - centerX, b[1] - centerZ) ||
        a[0] - b[0] ||
        a[1] - b[1],
    )
    const rng = createRng(deriveSeed(seed, `town:city:${id}`))
    const landmarks = new Map()
    for (const landmark of landmarkListOf(size, theme)) {
      if (byCenter.length === 0) break
      const choices = Math.min(town.centralLots, byCenter.length)
      const [lot] = byCenter.splice(Math.floor(rng() * choices), 1)
      landmarks.set(lotKey(...lot), landmark)
    }
    return landmarks
  }

  return {
    town,
    shareAt,
    isLotOpen,
    cityOf(blockX, blockZ) {
      const key = blockKey(blockX, blockZ)
      if (cities.has(key)) return cities.get(key)
      if (openLotsOf(blockX, blockZ).length === 0) return null
      const blocks = floodFrom(blockX, blockZ)
      const [firstX, firstZ] = blocks.reduce((min, block) =>
        block[0] < min[0] || (block[0] === min[0] && block[1] < min[1])
          ? block
          : min,
      )
      // A cidade da seed mais perto do meio do quarteirão de menor
      // coordenada (o mesmo para a cidade inteira).
      const site = sites?.nearestCity(
        (firstX + 0.5) * town.blockSize,
        (firstZ + 0.5) * town.blockSize,
      ).city
      const id = site?.id ?? blockKey(firstX, firstZ)
      const size = site?.size ?? null
      const lots = blocks.flatMap(([x, z]) => openLotsOf(x, z))
      const theme = themeOf(id)
      const city = {
        id,
        size,
        theme,
        landmarks: landmarksOf(id, lots, theme, size),
      }
      for (const [x, z] of blocks) cities.set(blockKey(x, z), city)
      return city
    },
    themeNear(x, z) {
      const blockX = Math.floor(x / town.blockSize)
      const blockZ = Math.floor(z / town.blockSize)
      for (const [dx, dz] of [[0, 0], ...NEIGHBORS]) {
        const city = this.cityOf(blockX + dx, blockZ + dz)
        if (city) return city.theme
      }
      return null
    },
  }
}
