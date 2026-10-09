import * as THREE from 'three'
import { listBiomes } from '@/core/data/biomes'
import { GAME_CONFIG } from '@/core/gameConfig'
import {
  createKindDensity,
  kindDensities,
} from '@/core/vegetation/vegetationDensity'
import {
  buildKindMeshes,
  finishMesh,
  setInstance,
  shareGeometry,
  tintAt,
} from './instancing'
import { blendGrassColors, scatterTile } from './vegetationScatter'

/**
 * Grama e flores por bloco de `GRASS.TILE_SIZE` m (docs/features/049-
 * vegetacao-e-floresta.md) — as malhas montadas em volta da câmera, até a
 * névoa. As de chunk (árvores, arbustos, pedras...) são do
 * `chunkMeshes.js`.
 */

const GRASS_KIND = 'tall-grass'
const FLOWER_KIND = 'flower'
// Separa o sorteio da grama do das flores (`scatterTile`).
const GRASS_SALT = 1
const FLOWER_SALT = 101
const COLOR_KEYS = ['root', 'tip', 'rootB', 'tipB']
// Nomes no shader (`grassMaterial.js`), na ordem de `COLOR_KEYS`.
const GRASS_COLOR_ATTRIBUTES = ['aRootA', 'aTipA', 'aRootB', 'aTipB']

const scratchColor = new THREE.Color()
const scratchScale = new THREE.Vector3()

/** Cores da grama de cada bioma do chunk (linear, 12 números) ou `null`. */
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
 * Grama de um bloco: um tufo por ponto de `scatterTile`, do tamanho de
 * `GRASS.HEIGHT`, com a cor dos biomas no lugar. Sem tufo, `null`.
 */
export function buildGrassMesh(
  chunk,
  tile,
  { geometry, material, bladeHeight },
) {
  const { GRASS, VEGETATION_QUALITY } = GAME_CONFIG
  const quality = VEGETATION_QUALITY[VEGETATION_QUALITY.CURRENT]
  const { points, density } = scatterKind(
    chunk,
    tile,
    GRASS_KIND,
    GRASS.CLUMPS_PER_M2 * quality.density,
    GRASS_SALT,
  )
  if (points.count === 0) return null
  // A cor pela grama de cada bioma (sem as clareiras: só a mistura).
  const densities = kindDensities(listBiomes(), chunk.biomeIds, GRASS_KIND)

  const own = shareGeometry(geometry)
  const wind = new Float32Array(points.count * 4)
  const colors = new Float32Array(points.count * 12)
  const colorTable = grassColorTable(chunk.biomeIds)
  const mesh = new THREE.InstancedMesh(own, material, points.count)
  const scale = GRASS.HEIGHT / bladeHeight
  for (let i = 0; i < points.count; i++) {
    const x = points.positions[i * 3]
    const z = points.positions[i * 3 + 2]
    const yaw = points.yaws[i]
    // Alta nos conjuntos de grama, baixa fora deles (só na vertical: a
    // folha não engorda).
    scratchScale.set(scale, scale * density.heightAt(x, z), scale)
    setInstance(mesh, i, x, points.positions[i * 3 + 1], z, yaw, scratchScale)
    wind.set([x, z, Math.cos(yaw), Math.sin(yaw)], i * 4)
    blendGrassColors(chunk, densities, colorTable, x, z, colors, i * 12)
  }
  own.setAttribute('aGrass', new THREE.InstancedBufferAttribute(wind, 4))
  // As quatro cores num buffer só (raiz, ponta, raiz B, ponta B).
  const colorBuffer = new THREE.InstancedInterleavedBuffer(colors, 12)
  GRASS_COLOR_ATTRIBUTES.forEach((name, index) =>
    own.setAttribute(
      name,
      new THREE.InterleavedBufferAttribute(colorBuffer, 3, index * 3),
    ),
  )
  mesh.receiveShadow = true
  return finishMesh(mesh)
}

/**
 * Flores de um bloco (moitas do MegaKit, `flowerModels`), cada uma num
 * tamanho e num tom. Na floresta, só
 * nas clareiras (`place: 'clearing'`).
 *
 * @returns {THREE.InstancedMesh[]}
 */
export function buildFlowerMeshes(chunk, tile, flowerModels) {
  const { FLOWERS, VEGETATION_QUALITY, TREES } = GAME_CONFIG
  const quality = VEGETATION_QUALITY[VEGETATION_QUALITY.CURRENT]
  const { points } = scatterKind(
    chunk,
    tile,
    FLOWER_KIND,
    FLOWERS.CLUMPS_PER_M2 * quality.density,
    FLOWER_SALT,
  )
  const [minScale, maxScale] = FLOWERS.SCALE
  const instances = Array.from({ length: points.count }, (_, i) => {
    const [x, y, z] = points.positions.subarray(i * 3, i * 3 + 3)
    return {
      x,
      y,
      z,
      yaw: points.yaws[i],
      scale: minScale + (maxScale - minScale) * points.sizes[i],
      variant: points.variants[i],
      tint: tintAt(x, z, TREES.TINT_VARIATION),
    }
  })
  return buildKindMeshes(flowerModels, instances)
}
