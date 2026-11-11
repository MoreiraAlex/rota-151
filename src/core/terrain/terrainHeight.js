import { createNoise2D } from 'simplex-noise'
import { listBiomes } from '../data/biomes'
import { GAME_CONFIG } from '../gameConfig'
import { createRng, deriveSeed } from '../rng'
import { solidParams } from '../vegetation/solidPlacement'
import { createBiomeSampler } from './biomeMap'
import { createCitySites } from '../town/citySites'
import { createRoads } from '../town/roads'
import { createWaterBodies } from './waterBodies'
import { rampShareAt, terracedHeight } from './terraces'
import {
  createMountainSites,
  dryShareAt,
  isDryAround,
  mountainAt,
  pathStartOf,
} from './mountains'

// Cada camada de ondulação tem metade do tamanho da anterior (o padrão da
// técnica)...
const LAYER_SHRINK = 2
// ...e a menor ainda tem pelo menos 2 vértices de largura (1 vértice por
// metro, `terrainChunk.js`) — menor que isso nem aparece na malha.
const SMALLEST_LAYER_SIZE = 2
// Quantas camadas (das maiores) ganham crista com `ridges`: a forma da
// serra. As menores ficam redondas — crista nelas vira vinco íngreme.
const RIDGE_LAYERS = 2
// A crista (`1 − |ruído|` ao quadrado, de 0 a 1, vezes 2 menos 1) tem média
// abaixo de zero: os vales desceriam muito mais do que os picos sobem. A
// média de `(1 − u)²` com `u` uniforme é um terço — somando de volta, ela
// fica em volta de zero, como o ruído redondo.
const RIDGE_SHIFT = 1 / 3
// Peso abaixo do qual um bioma não entra na altura (economiza o ruído dele
// longe da fronteira; o erro fica muito abaixo da precisão do float32).
const MIN_RELIEF_WEIGHT = 1e-6
// O ruído das rampas dos platôs é o mesmo do relevo, lido longe dele (um
// deslocamento grande: não acompanha os morros).
const RAMP_NOISE_OFFSET = 7919

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
 * @property {object} solids - `{ trees, rocks, clearings }`: os
 *   números dos objetos sólidos do chunk (`solidParams`,
 *   docs/features/049-vegetacao-e-floresta.md)
 * @property {object} trails - forma de `GAME_CONFIG.TRAILS` (core/terrain/
 *   trails.js)
 * @property {object} waterBodies - forma de `GAME_CONFIG.WATER_BODIES`
 *   (core/terrain/waterBodies.js)
 * @property {object} cities - forma de `GAME_CONFIG.CITIES`
 *   (core/town/citySites.js)
 * @property {object} roads - forma de `GAME_CONFIG.ROADS`
 *   (core/town/roads.js)
 * @property {object[]} biomeList - biomas (`core/data/biomes/`), na ordem
 *   do registro
 */
export function currentTerrainRecipe() {
  return {
    terrain: GAME_CONFIG.TERRAIN,
    biomes: GAME_CONFIG.BIOMES,
    solids: solidParams(),
    trails: GAME_CONFIG.TRAILS,
    waterBodies: GAME_CONFIG.WATER_BODIES,
    cities: GAME_CONFIG.CITIES,
    roads: GAME_CONFIG.ROADS,
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
 * anterior. Com `ridges` (docs/features/051-montanha.md), parte de cada
 * camada vira crista (`1 − |ruído|`, ao quadrado: serras e picos pontudos
 * no lugar de morros redondos). O resultado (-1 a 1) passa por `flatness`
 * (achata o meio) e vira metros (`hillHeight`). Com `terraces`
 * (docs/features/066-revisao-dos-biomas.md, `terraces.js`), a altura sobe
 * em patamares com barranco, e vira rampa nas manchas do ruído de rampa.
 * Com `mountains` (`mountains.js`), as montanhas da seed somam por cima.
 */
function createReliefSampler(noise2D, relief, mountainSites) {
  const { baseHeight, hillSize, hillHeight, roughness, flatness } = relief
  const ridges = relief.ridges ?? 0
  const terraces = relief.terraces ?? null
  const layers = countLayers(hillSize)

  return function reliefAt(x, z) {
    let sum = 0
    let weight = 1
    let totalWeight = 0
    let frequency = 1 / hillSize
    for (let layer = 0; layer < layers; layer++) {
      const noise = noise2D(x * frequency, z * frequency)
      const crest = 1 - Math.abs(noise)
      const ridged = crest * crest * 2 - 1 + RIDGE_SHIFT
      const share = layer < RIDGE_LAYERS ? ridges : 0
      sum += (noise + (ridged - noise) * share) * weight
      totalWeight += weight
      weight *= roughness
      frequency *= LAYER_SHRINK
    }
    // A crista centralizada pode passar um pouco de 1: `hillHeight` continua
    // sendo o quanto o morro sobe, no máximo.
    const value = Math.min(Math.max(sum / totalWeight, -1), 1)
    const hills =
      baseHeight + hillHeight * Math.sign(value) * Math.abs(value) ** flatness
    const mountain = mountainSites
      ? mountainAt(mountainSites.siteAt(x, z), x, z, relief.mountains).height
      : 0
    if (!terraces) return hills + mountain
    const rampFrequency = 1 / Math.max(terraces.rampSize, 1)
    const rampNoise =
      (noise2D(
        x * rampFrequency + RAMP_NOISE_OFFSET,
        z * rampFrequency - RAMP_NOISE_OFFSET,
      ) +
        1) /
      2
    return (
      terracedHeight(hills, terraces, rampShareAt(rampNoise, terraces.ramps)) +
      mountain
    )
  }
}

/**
 * O relevo do mundo (docs/features/045-terreno-de-um-chunk.md,
 * docs/features/047-biomas.md): em qualquer `(x, z)`, a altura (m) e os
 * pesos dos biomas (`biomeMap.js`). A altura é a média do relevo de cada
 * bioma pelo peso dele — na fronteira, um vira o outro aos poucos, sem
 * degrau. Alturas a partir de `WATER_LEVEL` (o chão médio de cada bioma é
 * medido da água). Depois da média, os lagos e rios cavam o relevo onde os
 * biomas aceitam (`water`, docs/features/057-lagos-e-rios.md) — rasos
 * onde as estradas cruzam (o vau, docs/features/058-ajuste-dos-biomas.md). Mesma seed e mesma receita, mesmo relevo em todo ponto;
 * ruído embaralhado pelo PRNG seedado, nunca `Math.random()`.
 *
 * @param {number} seed
 * @param {TerrainRecipe} [recipe]
 */
export function createTerrainSampler(seed, recipe = currentTerrainRecipe()) {
  const { terrain, biomes: params, biomeList } = recipe
  const waterBodies = createWaterBodies(
    seed,
    recipe.waterBodies ?? GAME_CONFIG.WATER_BODIES,
  )
  // As cidades da seed (docs/features/058-ajuste-dos-biomas.md) — só com o
  // bioma da cidade no mundo.
  const townBiome = biomeList.find(({ town }) => town)
  const cities = townBiome
    ? createCitySites(seed, {
        town: townBiome.town,
        waterBodies,
        params: recipe.cities ?? GAME_CONFIG.CITIES,
      })
    : null
  // As estradas entre elas: onde cruzam rio ou lago, o leito vira vau.
  const roadParams = recipe.roads ?? GAME_CONFIG.ROADS
  const roads = cities
    ? createRoads(seed, { cities, params: roadParams })
    : null

  /**
   * O leito (m, a partir da água) com o vau: fundo demais sob a estrada,
   * sobe até `FORD_DEPTH`.
   */
  function withFord(x, z, height) {
    if (!roads || height >= -roadParams.FORD_DEPTH) return height
    const ford = roads.fordAt(x, z)
    return height + ford * (-roadParams.FORD_DEPTH - height)
  }

  const biomeMap = createBiomeSampler(seed, {
    params,
    biomes: biomeList,
    cities,
  })
  // As montanhas de cada bioma com `relief.mountains`
  // (docs/features/066-revisao-dos-biomas.md), longe da água.
  const insideWater = (x, z) =>
    Math.max(waterBodies.insideRiver(x, z), waterBodies.insideLake(x, z))
  const mountainSites = biomeList.map((biome) =>
    biome.relief.mountains
      ? createMountainSites(seed, biome.id, biome.relief.mountains, (site) =>
          isDryAround(site, biome.relief.mountains, insideWater),
        )
      : null,
  )
  const hasMountains = mountainSites.some(Boolean)
  const reliefs = biomeList.map((biome, i) =>
    createReliefSampler(
      createNoise2D(createRng(deriveSeed(seed, `relief:${biome.id}`))),
      biome.relief,
      mountainSites[i],
    ),
  )
  const weights = new Float64Array(biomeList.length)
  const pathWeights = new Float64Array(biomeList.length)

  /**
   * O caminho até o topo das montanhas (0 a 1) em `(x, z)`, pelo peso de
   * cada bioma com montanha.
   */
  function mountainPathAt(x, z) {
    if (!hasMountains) return 0
    biomeMap.weightsAt(x, z, pathWeights)
    let path = 0
    for (let i = 0; i < biomeList.length; i++) {
      if (!mountainSites[i] || pathWeights[i] < MIN_RELIEF_WEIGHT) continue
      const params = biomeList[i].relief.mountains
      const site = mountainSites[i].siteAt(x, z)
      path += pathWeights[i] * mountainAt(site, x, z, params).path
    }
    return path
  }

  /**
   * Quanto `(x, z)` fica debaixo de montanha (0 a 1), pelo peso de cada
   * bioma com montanha (`dryShareAt`).
   */
  function mountainCoverAt(x, z) {
    if (!hasMountains) return 0
    biomeMap.weightsAt(x, z, pathWeights)
    let cover = 0
    for (let i = 0; i < biomeList.length; i++) {
      if (!mountainSites[i] || pathWeights[i] < MIN_RELIEF_WEIGHT) continue
      const params = biomeList[i].relief.mountains
      const site = mountainSites[i].siteAt(x, z)
      cover += pathWeights[i] * dryShareAt(site, x, z, params)
    }
    return cover
  }

  /**
   * A montanha mais perto de `(x, z)` no bioma dela (a de centro dentro do
   * bioma), com o começo do caminho (`foot`) — ou `null`.
   */
  function nearestMountain(x, z) {
    let best = null
    let bestDistance = Infinity
    for (let i = 0; i < biomeList.length; i++) {
      if (!mountainSites[i]) continue
      const params = biomeList[i].relief.mountains
      for (const site of mountainSites[i].sitesAround(x, z, 2)) {
        if (biomeMap.biomeAt(site.x, site.z).id !== biomeList[i].id) continue
        const distance = Math.hypot(site.x - x, site.z - z)
        if (distance >= bestDistance) continue
        bestDistance = distance
        best = {
          ...site,
          biome: biomeList[i].id,
          foot: pathStartOf(site, params),
        }
      }
    }
    return best
  }
  const waterShare = { rivers: 0, lakes: 0 }

  /**
   * Altura em `(x, z)`; os pesos dos biomas ficam em `weightsOut` (na ordem
   * de `biomeList`, somam 1).
   */
  function sample(x, z, weightsOut = weights) {
    biomeMap.weightsAt(x, z, weightsOut)
    let height = 0
    waterShare.rivers = 0
    waterShare.lakes = 0
    for (let i = 0; i < reliefs.length; i++) {
      if (weightsOut[i] < MIN_RELIEF_WEIGHT) continue
      height += weightsOut[i] * reliefs[i](x, z)
      // A montanha tira a água de baixo dela (`mountains.js`).
      const wet = mountainSites[i]
        ? weightsOut[i] *
          (1 -
            dryShareAt(
              mountainSites[i].siteAt(x, z),
              x,
              z,
              biomeList[i].relief.mountains,
            ))
        : weightsOut[i]
      waterShare.rivers += wet * (biomeList[i].water?.rivers ?? 0)
      waterShare.lakes += wet * (biomeList[i].water?.lakes ?? 0)
    }
    const carved = waterBodies.carveAt(x, z, height, waterShare)
    return terrain.WATER_LEVEL + withFord(x, z, carved)
  }

  return {
    biomes: biomeList,
    sample,
    heightAt: (x, z) => sample(x, z),
    biomeAt: biomeMap.biomeAt,
    // As cidades da seed (`null` sem o bioma da cidade): a mais próxima de
    // um ponto e a distância até ela (`citySites.js`).
    cities,
    // As estradas entre elas (`roads.js`; `null` sem cidades).
    roads,
    // Correnteza dos rios (só visual — `waterBodies.flowAt`).
    flowAt: waterBodies.flowAt,
    // O caminho das montanhas (0 a 1) e a montanha mais perto
    // (`mountains.js`).
    hasMountains,
    mountainPathAt,
    mountainCoverAt,
    nearestMountain,
  }
}
