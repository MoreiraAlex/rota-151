import { createNoise2D } from 'simplex-noise'
import { listBiomes } from '../data/biomes'
import { GAME_CONFIG } from '../gameConfig'
import { createRng, deriveSeed } from '../rng'
import { solidParams } from '../vegetation/solidPlacement'
import { createBiomeSampler } from './biomeMap'

// Cada camada de ondulação tem metade do tamanho da anterior (o padrão da
// técnica)...
const LAYER_SHRINK = 2
// ...e a menor ainda tem pelo menos 2 vértices de largura (1 vértice por
// metro, `terrainChunk.js`) — menor que isso nem aparece na malha.
const SMALLEST_LAYER_SIZE = 2
// Peso abaixo do qual um bioma não entra na altura (economiza o ruído dele
// longe da fronteira; o erro fica muito abaixo da precisão do float32).
const MIN_RELIEF_WEIGHT = 1e-6

/** Quantas camadas cabem de `hillSize` até a menor visível. */
export function countLayers(hillSize) {
  return (
    Math.floor(
      Math.log(hillSize / SMALLEST_LAYER_SIZE) / Math.log(LAYER_SHRINK),
    ) + 1
  )
}

/**
 * A receita do relevo agora: a config (`GAME_CONFIG.TERRAIN`/`BIOMES` e os
 * números dos objetos sólidos) e os biomas do registro, menos os escondidos
 * (`BIOMES.HIDDEN`).
 * Os chunks guardam uma CÓPIA (`copyTerrainRecipe`) — o painel de ajuste
 * (F2) mexe nos originais ao vivo.
 *
 * @typedef {object} TerrainRecipe
 * @property {object} terrain - forma de `GAME_CONFIG.TERRAIN`
 * @property {object} biomes - forma de `GAME_CONFIG.BIOMES`
 * @property {object} solids - `{ trees, logs, rocks, clearings }`: os
 *   números dos objetos sólidos do chunk (`solidParams`,
 *   docs/features/049-vegetacao-e-floresta.md)
 * @property {object} trails - forma de `GAME_CONFIG.TRAILS` (core/terrain/
 *   trails.js)
 * @property {object[]} biomeList - biomas (`core/data/biomes/`), na ordem
 *   do registro
 */
export function currentTerrainRecipe() {
  return {
    terrain: GAME_CONFIG.TERRAIN,
    biomes: GAME_CONFIG.BIOMES,
    solids: solidParams(),
    trails: GAME_CONFIG.TRAILS,
    biomeList: listBiomes().filter(
      ({ id }) => !GAME_CONFIG.BIOMES.HIDDEN.includes(id),
    ),
  }
}

/** Cópia funda da receita (nada dela muda depois). */
export function copyTerrainRecipe(recipe) {
  return structuredClone(recipe)
}

/**
 * Altura (m, a partir do chão médio do bioma) dos morros de um bioma em
 * `(x, z)`. Soma camadas de simplex: a primeira do tamanho dos morros
 * (`hillSize`), cada uma seguinte menor e pesando `roughness` vezes a
 * anterior. O resultado (-1 a 1) passa por `flatness` (achata o meio) e
 * vira metros (`hillHeight`).
 */
function createReliefSampler(noise2D, relief) {
  const { baseHeight, hillSize, hillHeight, roughness, flatness } = relief
  const layers = countLayers(hillSize)

  return function reliefAt(x, z) {
    let sum = 0
    let weight = 1
    let totalWeight = 0
    let frequency = 1 / hillSize
    for (let layer = 0; layer < layers; layer++) {
      sum += noise2D(x * frequency, z * frequency) * weight
      totalWeight += weight
      weight *= roughness
      frequency *= LAYER_SHRINK
    }
    const value = sum / totalWeight
    return (
      baseHeight + hillHeight * Math.sign(value) * Math.abs(value) ** flatness
    )
  }
}

/**
 * O relevo do mundo (docs/features/045-terreno-de-um-chunk.md,
 * docs/features/047-biomas.md): em qualquer `(x, z)`, a altura (m) e os
 * pesos dos biomas (`biomeMap.js`). A altura é a média do relevo de cada
 * bioma pelo peso dele — na fronteira, um vira o outro aos poucos, sem
 * degrau. Alturas a partir de `WATER_LEVEL` (o chão médio de cada bioma é
 * medido da água). Mesma seed e mesma receita, mesmo relevo em todo ponto;
 * ruído embaralhado pelo PRNG seedado, nunca `Math.random()`.
 *
 * @param {number} seed
 * @param {TerrainRecipe} [recipe]
 */
export function createTerrainSampler(seed, recipe = currentTerrainRecipe()) {
  const { terrain, biomes: params, biomeList } = recipe
  const biomeMap = createBiomeSampler(seed, { params, biomes: biomeList })
  const reliefs = biomeList.map((biome) =>
    createReliefSampler(
      createNoise2D(createRng(deriveSeed(seed, `relief:${biome.id}`))),
      biome.relief,
    ),
  )
  const weights = new Float64Array(biomeList.length)

  /**
   * Altura em `(x, z)`; os pesos dos biomas ficam em `weightsOut` (na ordem
   * de `biomeList`, somam 1).
   */
  function sample(x, z, weightsOut = weights) {
    biomeMap.weightsAt(x, z, weightsOut)
    let height = 0
    for (let i = 0; i < reliefs.length; i++) {
      if (weightsOut[i] < MIN_RELIEF_WEIGHT) continue
      height += weightsOut[i] * reliefs[i](x, z)
    }
    return terrain.WATER_LEVEL + height
  }

  return {
    biomes: biomeList,
    sample,
    heightAt: (x, z) => sample(x, z),
    biomeAt: biomeMap.biomeAt,
  }
}
