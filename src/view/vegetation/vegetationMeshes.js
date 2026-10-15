import * as THREE from 'three'
import { listBiomes } from '@/core/data/biomes'
import { GAME_CONFIG } from '@/core/gameConfig'
import { patchNoiseFor } from '@/core/vegetation/clearings'
import {
  createKindDensity,
  kindDensities,
} from '@/core/vegetation/vegetationDensity'
import { createBiomeTint, createTint } from './biomeColor'
import { buildKindMeshes } from './instancing'
import { entryOf, groupByBiome, lgpePlantScale, modelsOf } from './biomeModels'
import { blendGrassColors, hash01, scatterTile } from './vegetationScatter'

/**
 * Grama e flores por bloco de `GRASS.TILE_SIZE` m (docs/features/049-
 * vegetacao-e-floresta.md) — as malhas montadas em volta da câmera, até a
 * névoa. As de chunk (árvores, arbustos, pedras...) são do
 * `chunkMeshes.js`.
 */

const GRASS_KIND = 'tall-grass'
const FLOWER_KIND = 'flower'
const ENCOUNTER_KIND = 'encounter-grass'
// Separa o sorteio da grama do das flores (`scatterTile`).
const GRASS_SALT = 1
const FLOWER_SALT = 101
const ENCOUNTER_SALT = 701
// As duas cores da grama do bioma (`colors`), na ordem da mistura.
const COLOR_KEYS = ['a', 'b']

const scratchColor = new THREE.Color()

/** Cores da grama de cada bioma do chunk (linear, `a` e `b`) ou `null`. */
function grassColorTable(biomeIds) {
  const biomes = listBiomes()
  return biomeIds.map((id) => {
    const biome = biomes.find((candidate) => candidate.id === id)
    const grass = biome?.vegetation.find(({ kind }) => kind === GRASS_KIND)
    if (!grass?.colors) return null
    return COLOR_KEYS.flatMap((key) =>
      scratchColor.set(grass.colors[key]).toArray(),
    )
  })
}

// Pontos de um tipo num bloco (com as clareiras, as manchas, os conjuntos
// de grama e sem as pegadas dos sólidos), e a densidade usada (a altura dos
// conjuntos sai dela, `heightAt`).
function scatterKind(chunk, tile, kind, perM2, salt) {
  const { GRASS, TERRAIN } = GAME_CONFIG
  const density = createKindDensity(chunk, kind, {
    biomeList: listBiomes(),
    seed: chunk.vegetationSeed,
  })
  const points = scatterTile(chunk, {
    tileX: tile.tileX,
    tileZ: tile.tileZ,
    tileSize: GRASS.TILE_SIZE,
    perM2,
    density,
    salt,
    minHeight: TERRAIN.WATER_LEVEL + GRASS.SHORE_GAP,
    maxSlope: GRASS.MAX_SLOPE,
    avoid: chunk.solids?.footprints,
  })
  return { points, density }
}

/**
 * Grama de um bloco: um tufo por ponto de `scatterTile`, nos modelos do
 * Let's Go do bioma onde está (`models` da entrada `tall-grass`). O tamanho
 * é sorteado em `GRASS.SCALE`; a altura (só na vertical) é `GRASS.HEIGHT`
 * vezes a dos conjuntos de grama e a das manchas de altura. O tom é a cor
 * dos biomas no lugar, da `a` para a `b` em manchas, com claro e escuro.
 *
 * @returns {THREE.InstancedMesh[]}
 */
export function buildGrassMeshes(chunk, tile, models) {
  const { GRASS, VEGETATION_QUALITY } = GAME_CONFIG
  const quality = VEGETATION_QUALITY[VEGETATION_QUALITY.CURRENT]
  const { points, density } = scatterKind(
    chunk,
    tile,
    GRASS_KIND,
    GRASS.CLUMPS_PER_M2 * quality.density,
    GRASS_SALT,
  )
  if (points.count === 0) return []
  // A cor pela grama de cada bioma (sem as clareiras: só a mistura).
  const densities = kindDensities(listBiomes(), chunk.biomeIds, GRASS_KIND)
  const colorTable = grassColorTable(chunk.biomeIds)
  const seed = chunk.vegetationSeed ?? 0
  const heightNoise = patchNoiseFor(
    seed,
    'grass-height',
    GRASS.HEIGHT_PATCH_SIZE,
  )
  const colorNoise = patchNoiseFor(seed, 'grass-color', GRASS.COLOR_PATCH_SIZE)
  const macroNoise = patchNoiseFor(seed, 'grass-macro', GRASS.MACRO_SIZE)
  const [minScale, maxScale] = GRASS.SCALE
  const colors = new Float32Array(6)
  // A tinta do bioma (`tint`), por cima das duas cores.
  const recolorOf = createBiomeTint(chunk, GRASS_KIND)
  const instances = []
  for (let i = 0; i < points.count; i++) {
    const [x, y, z] = points.positions.subarray(i * 3, i * 3 + 3)
    const size = minScale + (maxScale - minScale) * points.sizes[i]
    // Alta nos conjuntos de grama, baixa fora deles, e em manchas.
    const patch = 1 + (heightNoise(x, z) * 2 - 1) * GRASS.HEIGHT_VARIATION
    const height =
      GRASS.HEIGHT *
      density.heightAt(x, z) *
      Math.min(1.8, Math.max(0.2, patch))
    blendGrassColors(chunk, densities, colorTable, x, z, colors, 0)
    const towardB = colorNoise(x, z) * GRASS.COLOR_VARIATION
    const light = 1 + (macroNoise(x, z) * 2 - 1) * GRASS.MACRO_VARIATION
    const tint = new THREE.Color(
      (colors[0] + (colors[3] - colors[0]) * towardB) * light,
      (colors[1] + (colors[4] - colors[1]) * towardB) * light,
      (colors[2] + (colors[5] - colors[2]) * towardB) * light,
    )
    instances.push({
      x,
      y,
      z,
      yaw: points.yaws[i],
      scale: new THREE.Vector3(size, size * height, size),
      variant: points.variants[i],
      tint,
      recolor: recolorOf?.(x, z),
    })
  }
  return [...groupByBiome(chunk, instances, GRASS_KIND)].flatMap(
    ([biomeId, group]) =>
      buildKindMeshes(modelsOf(models, GRASS_KIND, biomeId), group),
  )
}

/**
 * Flores de um bloco, cada uma num tamanho e num tom (com a tinta do
 * bioma, `tint`), nos modelos do bioma onde está (`modelsOf`). Na
 * floresta, só nas clareiras (`place: 'clearing'`).
 *
 * @returns {THREE.InstancedMesh[]}
 */
export function buildFlowerMeshes(chunk, tile, models) {
  const { FLOWERS, VEGETATION_QUALITY, TREES } = GAME_CONFIG
  const tintOf = createTint(chunk, FLOWER_KIND, TREES.TINT_VARIATION)
  const quality = VEGETATION_QUALITY[VEGETATION_QUALITY.CURRENT]
  const { points } = scatterKind(
    chunk,
    tile,
    FLOWER_KIND,
    FLOWERS.CLUMPS_PER_M2 * quality.density,
    FLOWER_SALT,
  )
  const instances = Array.from({ length: points.count }, (_, i) => {
    const [x, y, z] = points.positions.subarray(i * 3, i * 3 + 3)
    return {
      x,
      y,
      z,
      yaw: points.yaws[i],
      size: points.sizes[i],
      variant: points.variants[i],
      ...tintOf(x, z),
    }
  })
  return [...groupByBiome(chunk, instances, FLOWER_KIND)].flatMap(
    ([biomeId, group]) => {
      const entry = entryOf(biomeId, FLOWER_KIND)
      const sized = group.map((item) => ({
        ...item,
        scale: lgpePlantScale(item.size, entry),
      }))
      return buildKindMeshes(modelsOf(models, FLOWER_KIND, biomeId), sized)
    },
  )
}

/**
 * Mato alto do LGPE de um bloco (`encounter-grass`, o "mato de encontro"
 * dos jogos): só nos biomas que têm a entrada, no miolo dos conjuntos de
 * grama (onde a altura deles passa de `ENCOUNTER_GRASS.MIN_CLUSTER_HEIGHT`),
 * com a `density` da entrada.
 *
 * @returns {THREE.InstancedMesh[]}
 */
export function buildEncounterGrassMeshes(chunk, tile, models) {
  const { ENCOUNTER_GRASS, VEGETATION_QUALITY } = GAME_CONFIG
  const quality = VEGETATION_QUALITY[VEGETATION_QUALITY.CURRENT]
  const hasEntry = chunk.biomeIds.some((id) => entryOf(id, ENCOUNTER_KIND))
  if (!hasEntry) return []
  const { points, density } = scatterKind(
    chunk,
    tile,
    GRASS_KIND,
    ENCOUNTER_GRASS.PER_M2 * quality.density,
    ENCOUNTER_SALT,
  )
  const [minScale, maxScale] = ENCOUNTER_GRASS.SCALE
  const tintOf = createTint(
    chunk,
    ENCOUNTER_KIND,
    GAME_CONFIG.TREES.TINT_VARIATION / 2,
  )
  const instances = []
  for (let i = 0; i < points.count; i++) {
    const [x, y, z] = points.positions.subarray(i * 3, i * 3 + 3)
    if (density.heightAt(x, z) < ENCOUNTER_GRASS.MIN_CLUSTER_HEIGHT) continue
    instances.push({
      x,
      y,
      z,
      yaw: points.yaws[i],
      scale: minScale + (maxScale - minScale) * points.sizes[i],
      variant: points.variants[i],
      ...tintOf(x, z),
    })
  }
  return [...groupByBiome(chunk, instances, ENCOUNTER_KIND)].flatMap(
    ([biomeId, group]) => {
      const entry = entryOf(biomeId, ENCOUNTER_KIND)
      if (!entry) return []
      // A `density` da entrada deixa uma parte dos pontos (sorteio fixo).
      const kept = group.filter(
        (item) =>
          hash01(Math.floor(item.x * 7), Math.floor(item.z * 7), 703) <
          entry.density,
      )
      return buildKindMeshes(modelsOf(models, ENCOUNTER_KIND, biomeId), kept)
    },
  )
}
