import { GAME_CONFIG } from '../gameConfig'
import { clamp } from '../math'
import { chunkHeightAt, heightIndex } from '../terrain/terrainChunk'
import { naturalTrailAt, trailAt } from '../terrain/trails'
import { clearingNoiseAt, opennessOf } from './clearings'
import { createGrassClusterField } from './grassClusters'
import { patchAt } from './patches'
import { vegetationEntryOf } from './vegetationEntry'

/**
 * Quanto de um tipo de vegetação nasce em cada ponto de um chunk
 * (docs/features/049-vegetacao-e-floresta.md): a `density` do tipo em
 * cada bioma (`vegetation`, core/data/biomes/), misturada pelo peso dos
 * biomas no lugar — na fronteira, a vegetação de um rareia enquanto a do
 * outro aparece. Nos biomas com clareiras, o `place` do tipo muda a
 * densidade pelo ponto, o `patches` junta o tipo em manchas e nada nasce
 * nas trilhas (`createKindDensity`). Também a inclinação do chão
 * (sem árvore nem grama em encosta). Funções puras sobre o `TerrainChunk`.
 */

/**
 * `density` do tipo `kind` em cada bioma do chunk, na ordem de
 * `chunk.biomeIds` (0 onde o bioma não tem o tipo). `biomeList` são os
 * biomas da receita do relevo.
 */
export function kindDensities(biomeList, biomeIds, kind) {
  return Float32Array.from(biomeIds, (id) => {
    const biome = biomeList.find((candidate) => candidate.id === id)
    return vegetationEntryOf(biome, kind)?.density ?? 0
  })
}

/**
 * Posição `(x, z)` em coordenadas da grade do chunk: célula `(ix, iz)` e a
 * fração `(u, v)` dentro dela.
 */
function cellAt(chunk, x, z) {
  const { resolution } = chunk
  const step = chunk.size / resolution
  const fx = clamp((x - chunk.minX) / step, 0, resolution)
  const fz = clamp((z - chunk.minZ) / step, 0, resolution)
  const ix = Math.min(Math.floor(fx), resolution - 1)
  const iz = Math.min(Math.floor(fz), resolution - 1)
  return { ix, iz, u: fx - ix, v: fz - iz, step }
}

/** Densidade (0 a 1) num vértice: soma de peso × densidade de cada bioma. */
function vertexDensity(chunk, densities, ix, iz) {
  const count = chunk.biomeIds.length
  const base = heightIndex(chunk.resolution, ix, iz) * count
  let sum = 0
  for (let biome = 0; biome < count; biome++) {
    sum += (chunk.biomeWeights[base + biome] / 255) * densities[biome]
  }
  return sum
}

/**
 * Densidade (0 a 1) do tipo em `(x, z)`, com `densities` de
 * `kindDensities` — interpolada entre os quatro vértices da célula.
 */
export function densityAt(chunk, densities, x, z) {
  const { ix, iz, u, v } = cellAt(chunk, x, z)
  const at = (dx, dz) => vertexDensity(chunk, densities, ix + dx, iz + dz)
  const near = at(0, 0) * (1 - u) + at(1, 0) * u
  const far = at(0, 1) * (1 - u) + at(1, 1) * u
  return near * (1 - v) + far * v
}

/**
 * @typedef {object} KindDensity
 * @property {boolean} isEmpty - nenhum bioma do chunk tem o tipo
 * @property {(x: number, z: number) => number} at - densidade (0 a 1)
 * @property {(x: number, z: number) => number} heightAt - multiplicador da
 *   altura (os conjuntos de grama, `clusters`; 1 sem eles)
 */

// Quanto do tipo fica num ponto com abertura `open` (0 = mata, 1 =
// clareira), pelo `place` dele. No de clareira, `shade` é a fração que
// ainda fica na mata (0 = só na clareira).
const PLACE_FACTOR = {
  shade: () => (open) => 1 - open,
  clearing:
    ({ shade = 0 }) =>
    (open) =>
      shade + (1 - shade) * open,
}

/**
 * Densidade do tipo `kind` em qualquer ponto do chunk, com as clareiras e
 * as manchas (docs/features/049-vegetacao-e-floresta.md): em cada bioma
 * com `clearings`, um tipo com `place: 'shade'` rareia onde é aberto e um
 * com `place: 'clearing'` fica onde é aberto (e só o `shade` dele na mata);
 * com `patches`, o tipo só fica dentro das manchas dele (`patchAt`); com
 * `clusters` (a grama), segue os conjuntos de grama (`grassClusterAt`, que
 * também dão a altura, `heightAt`); com `maxHeight` (a linha das árvores,
 * docs/features/051-montanha.md), rareia na faixa `altitude.FADE` abaixo
 * dele e some acima; e
 * rareia até sumir no meio das trilhas do chunk (`trailAt`) — menos o de
 * `place: 'trail'`, que só nasce nelas. `seed`
 * = a das clareiras e manchas (a do relevo); `clearings` = forma de
 * `GAME_CONFIG.CLEARINGS`; `terrain` = forma de `GAME_CONFIG.TERRAIN` (o
 * nível da água, de onde o `maxHeight` é medido). Sem clareira, mancha nem
 * altura máxima no chunk, é o `densityAt` de sempre.
 *
 * @returns {KindDensity}
 */
export function createKindDensity(
  chunk,
  kind,
  {
    biomeList,
    seed,
    clearings = GAME_CONFIG.CLEARINGS,
    patches = GAME_CONFIG.VEGETATION_PATCHES,
    altitude = GAME_CONFIG.VEGETATION_ALTITUDE,
    terrain = GAME_CONFIG.TERRAIN,
  },
) {
  const densities = kindDensities(biomeList, chunk.biomeIds, kind)
  const isEmpty = densities.every((density) => density === 0)
  const shaping = chunk.biomeIds.map((id) => {
    const biome = biomeList.find((candidate) => candidate.id === id)
    const entry = vegetationEntryOf(biome, kind)
    const amount = biome?.clearings?.amount ?? 0
    const factor =
      amount > 0 && PLACE_FACTOR[entry?.place]
        ? PLACE_FACTOR[entry.place](entry)
        : null
    const maxHeight = entry?.maxHeight ?? null
    if (!factor && !entry?.patches && !entry?.clusters && maxHeight === null) {
      return null
    }
    const opennessAt = (x, z) =>
      amount > 0
        ? opennessOf(clearingNoiseAt(seed, x, z, clearings), amount, clearings)
        : null
    return {
      factor,
      amount,
      patches: entry?.patches,
      maxHeight,
      // Os conjuntos numa grade guardada (a grama pergunta muitos pontos).
      clusters:
        entry?.clusters &&
        createGrassClusterField(seed, entry.clusters, opennessAt),
    }
  })
  // O que é de trilha (`place: 'trail'`, os seixos) só nasce nela — não
  // na rua das cidades; o resto, fora das duas. Por bioma: o mesmo tipo
  // pode ser de trilha num e espalhado no outro (os seixos da savana,
  // docs/features/066-revisao-dos-biomas.md).
  const onTrail = chunk.biomeIds.map(
    (id) =>
      vegetationEntryOf(
        biomeList.find((candidate) => candidate.id === id),
        kind,
      )?.place === 'trail',
  )
  const placedAt = createTrailPlacement(chunk, onTrail, kind)
  if (isEmpty || shaping.every((item) => !item)) {
    return {
      isEmpty,
      at: (x, z) => placedAt(densities, x, z),
      heightAt: () => 1,
    }
  }

  const hasAltitude = shaping.some((item) => item && item.maxHeight !== null)
  const scaled = new Float32Array(densities.length)
  const heights = new Float32Array(densities.length)
  // A densidade de cada bioma no ponto (em `scaled`) e a altura dos
  // conjuntos de grama dele (em `heights`).
  const shapeAt = (x, z) => {
    const noise = clearingNoiseAt(seed, x, z, clearings)
    const height = hasAltitude
      ? chunkHeightAt(chunk, x, z) - terrain.WATER_LEVEL
      : 0
    shaping.forEach((item, biome) => {
      let density = densities[biome]
      heights[biome] = 1
      if (item?.factor) {
        density *= item.factor(opennessOf(noise, item.amount, clearings))
      }
      if (item?.patches) {
        density *= patchAt(seed, kind, item.patches, x, z, patches)
      }
      if (item?.clusters) {
        const cluster = item.clusters(x, z)
        density *= cluster.density
        heights[biome] = cluster.height
      }
      if (item?.maxHeight != null) {
        density *= clamp((item.maxHeight - height) / altitude.FADE, 0, 1)
      }
      scaled[biome] = density
    })
  }
  return {
    isEmpty,
    at(x, z) {
      shapeAt(x, z)
      return placedAt(scaled, x, z)
    },
    // A altura dos biomas pesada pelo quanto de grama cada um põe ali.
    heightAt(x, z) {
      shapeAt(x, z)
      const total = densityAt(chunk, scaled, x, z)
      if (total <= 0) return 1
      for (let biome = 0; biome < heights.length; biome++) {
        heights[biome] *= scaled[biome]
      }
      return densityAt(chunk, heights, x, z) / total
    },
  }
}

/**
 * A densidade (`values`, uma por bioma do chunk) com as trilhas: a dos
 * biomas em que o tipo é de trilha (`onTrail`) só nelas (`naturalTrailAt`),
 * a dos outros fora delas e da rua (`trailAt`, pelo tipo `kind`), cada
 * parte misturada pelo peso dos biomas no ponto.
 */
function createTrailPlacement(chunk, onTrail, kind) {
  const offTrail = (x, z) => 1 - trailAt(chunk, x, z, kind)
  if (!onTrail.some(Boolean)) {
    return (values, x, z) => densityAt(chunk, values, x, z) * offTrail(x, z)
  }
  if (onTrail.every(Boolean)) {
    return (values, x, z) =>
      densityAt(chunk, values, x, z) * naturalTrailAt(chunk, x, z)
  }
  const trailPart = new Float32Array(onTrail.length)
  const otherPart = new Float32Array(onTrail.length)
  return (values, x, z) => {
    for (let biome = 0; biome < onTrail.length; biome++) {
      trailPart[biome] = onTrail[biome] ? values[biome] : 0
      otherPart[biome] = onTrail[biome] ? 0 : values[biome]
    }
    return (
      densityAt(chunk, trailPart, x, z) * naturalTrailAt(chunk, x, z) +
      densityAt(chunk, otherPart, x, z) * offTrail(x, z)
    )
  }
}

/** Inclinação (rad) do chão na célula que contém `(x, z)`. */
export function slopeAt(chunk, x, z) {
  const { ix, iz, step } = cellAt(chunk, x, z)
  const height = (dx, dz) =>
    chunk.heights[heightIndex(chunk.resolution, ix + dx, iz + dz)]
  const alongX = (height(1, 0) - height(0, 0) + height(1, 1) - height(0, 1)) / 2
  const alongZ = (height(0, 1) - height(0, 0) + height(1, 1) - height(1, 0)) / 2
  return Math.atan(Math.hypot(alongX, alongZ) / step)
}
