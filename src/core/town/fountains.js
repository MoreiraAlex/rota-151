import { getBiome } from '../data/biomes'

/**
 * A água das fontes das praças (docs/features/069-revisao-do-bioma-
 * cidade.md). A fonte é afundada no chão mais alto debaixo dela
 * (`plaza.fountainSink`, para a borda ficar baixa e qualquer um passar por
 * cima) e não tem piso: o fundo é o próprio chão da praça. A água fica
 * `plaza.water.depth` m acima desse chão — rasa, como a beirada dos rios
 * — num disco do raio de dentro da bacia (`plaza.water.radius`, no tamanho
 * do modelo).
 *
 * @typedef {object} FountainWater
 * @property {number} x - o meio
 * @property {number} z
 * @property {number} radius - m
 * @property {number} surface - a altura (m) da superfície
 * @property {object} water - os números da água (`plaza.water`)
 */

/**
 * A água de um objeto da cidade, se ele é a fonte da praça do bioma dele
 * (`town.props.fountain`, com `plaza.water`); senão `null`.
 *
 * @returns {FountainWater | null}
 */
export function fountainWaterOf(building) {
  const town = getBiome(building.biome)?.town
  const water = town?.plaza?.water
  if (!water || building.model !== town.props.fountain) return null
  // `y` é o chão menos o quanto ela afundou.
  const ground = building.y + (town.plaza.fountainSink ?? 0)
  return {
    x: building.x,
    z: building.z,
    radius: water.radius * building.scale,
    surface: ground + water.depth,
    water,
  }
}

// As fontes de cada chunk (as listas não mudam enquanto ele existe).
const fountainsByChunk = new WeakMap()

/** A água das fontes do chunk (`chunk.solids.buildings`). */
export function fountainsOfChunk(chunk) {
  if (fountainsByChunk.has(chunk)) return fountainsByChunk.get(chunk)
  const fountains = (chunk.solids?.buildings ?? [])
    .map(fountainWaterOf)
    .filter(Boolean)
  if (chunk.solids) fountainsByChunk.set(chunk, fountains)
  return fountains
}

/** A fonte cuja água cobre `(x, z)`, entre `fountains`, ou `null`. */
export function fountainAt(fountains, x, z) {
  return (
    fountains.find(
      (fountain) =>
        Math.hypot(x - fountain.x, z - fountain.z) < fountain.radius,
    ) ?? null
  )
}
