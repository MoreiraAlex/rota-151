import { GAME_CONFIG } from '../gameConfig'
import { createRng, deriveSeed } from '../rng'

/**
 * Onde ficam as cidades (docs/features/058-ajuste-dos-biomas.md): o mundo é
 * uma grade de células de `CITIES.SPACING` m, e cada célula tem uma cidade,
 * a âncora da área em volta dela. Puro e determinístico (mesma seed, mesmas
 * cidades), sem chunk — o mapa de biomas (`biomeMap.js`) pinta a cidade num
 * disco em volta de cada uma.
 *
 * - A célula `(0, 0)` é a **primeira cidade**: centrada na origem, onde o
 *   treinador nasce, do porte `CITIES.FIRST_SIZE`.
 * - As outras são sorteadas perto do centro da célula (`CITIES.JITTER`,
 *   fração dela) e longe da água: se o centro ou a volta do disco ficam a
 *   menos de `CITIES.WATER_GAP` de rio ou lago, sorteia de novo
 *   (`CITIES.TRIES`); sem ponto seco, fica o de menos água — o centro seco
 *   primeiro. A cidade não tem água (`water` do bioma): onde o disco pega
 *   rio ou lago, a água para na borda dela.
 * - O **porte** (`town.sizes` do bioma da cidade, pelo `weight`) dá o raio
 *   da cidade.
 *
 * Os rios e lagos vêm de `waterBodies.js`, que só depende da seed — sem
 * ciclo com o relevo, que depende das cidades.
 *
 * @typedef {object} CitySite
 * @property {string} id - a célula, `"x,z"`
 * @property {number} cellX
 * @property {number} cellZ
 * @property {number} x - centro (m)
 * @property {number} z
 * @property {object} size - a entrada de `town.sizes`
 * @property {number} radius - m
 *
 * @typedef {object} CitySites
 * @property {(cellX: number, cellZ: number) => CitySite} cityAt
 * @property {(x: number, z: number) => { city: CitySite, distance: number }}
 *   nearestCity - a cidade mais próxima de `(x, z)` e a distância (m) até o
 *   centro dela
 * @property {(x: number) => number} cellOf - a célula de uma coordenada
 * @property {number} edge - largura (m) da borda da cidade no mapa de
 *   biomas (`CITIES.EDGE`)
 */

// Pontos em volta do disco medidos contra a água (além do centro).
const WATER_PROBES = 8
// Quantas células para cada lado a busca da mais próxima olha: o sorteio
// fica a no máximo `JITTER` do centro, então a mais próxima está sempre a
// uma célula (testado contra a busca exaustiva).
const NEAREST_REACH = 1

/**
 * @param {number} seed
 * @param {object} options
 * @param {object} options.town - o `town` do bioma da cidade (`sizes`)
 * @param {{ insideRiver: Function, insideLake: Function }} options.waterBodies
 * @param {object} [options.params] - forma de `GAME_CONFIG.CITIES`
 * @returns {CitySites}
 */
export function createCitySites(
  seed,
  { town, waterBodies, params = GAME_CONFIG.CITIES },
) {
  const { SPACING, JITTER, WATER_GAP, TRIES, EDGE, FIRST_SIZE } = params
  const { sizes } = town
  const totalWeight = sizes.reduce((sum, { weight }) => sum + weight, 0)
  const firstSize = sizes.find(({ id }) => id === FIRST_SIZE) ?? sizes[0]
  const cache = new Map()

  // `|| 0`: sem o -0 de `Math.round` (a célula vira chave e id).
  const cellOf = (value) => Math.round(value / SPACING) || 0

  function sizeFrom(roll) {
    let left = roll * totalWeight
    for (const size of sizes) {
      left -= size.weight
      if (left < 0) return size
    }
    return sizes.at(-1)
  }

  const isWet = (x, z) =>
    waterBodies.insideRiver(x, z) > -WATER_GAP ||
    waterBodies.insideLake(x, z) > -WATER_GAP

  // Quanta água em volta do disco: o centro molhado pesa mais que a volta
  // inteira (o meio da cidade seco vem primeiro).
  function wetness(x, z, radius) {
    let wet = isWet(x, z) ? WATER_PROBES + 1 : 0
    for (let i = 0; i < WATER_PROBES; i++) {
      const angle = (i / WATER_PROBES) * Math.PI * 2
      if (isWet(x + Math.cos(angle) * radius, z + Math.sin(angle) * radius)) {
        wet++
      }
    }
    return wet
  }

  function placeCity(cellX, cellZ) {
    const id = `${cellX},${cellZ}`
    if (cellX === 0 && cellZ === 0) {
      return {
        id,
        cellX,
        cellZ,
        x: 0,
        z: 0,
        size: firstSize,
        radius: firstSize.radius,
      }
    }
    const rng = createRng(deriveSeed(seed, `city:${id}`))
    const size = sizeFrom(rng())
    let best = null
    for (let attempt = 0; attempt < TRIES; attempt++) {
      const x = (cellX + (rng() * 2 - 1) * JITTER) * SPACING
      const z = (cellZ + (rng() * 2 - 1) * JITTER) * SPACING
      const wet = wetness(x, z, size.radius)
      if (!best || wet < best.wet) best = { x, z, wet }
      if (wet === 0) break
    }
    return { id, cellX, cellZ, x: best.x, z: best.z, size, radius: size.radius }
  }

  function cityAt(cellX, cellZ) {
    const key = `${cellX},${cellZ}`
    let city = cache.get(key)
    if (!city) {
      city = placeCity(cellX, cellZ)
      cache.set(key, city)
    }
    return city
  }

  function nearestCity(x, z) {
    const cellX = cellOf(x)
    const cellZ = cellOf(z)
    let city = null
    let distance = Infinity
    for (let dx = -NEAREST_REACH; dx <= NEAREST_REACH; dx++) {
      for (let dz = -NEAREST_REACH; dz <= NEAREST_REACH; dz++) {
        const candidate = cityAt(cellX + dx, cellZ + dz)
        const d = Math.hypot(x - candidate.x, z - candidate.z)
        if (d < distance) {
          distance = d
          city = candidate
        }
      }
    }
    return { city, distance }
  }

  return { cityAt, nearestCity, cellOf, edge: EDGE }
}
