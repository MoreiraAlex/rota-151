import * as THREE from 'three'
import { getBiome } from '@/core/data/biomes'
import { GAME_CONFIG } from '@/core/gameConfig'
import { heightIndex } from '@/core/terrain/terrainChunk'
import { TERRAIN_COLOR_MODES } from './terrainColorMode'
import { MAX_TERRAIN_LAYERS, terrainLayerIndex } from './terrainLayers'

// Uma `THREE.Color` por cor de paleta (as paletas não mudam em jogo).
const parsedColors = new Map()
const colorOf = (hex) => {
  if (!parsedColors.has(hex)) parsedColors.set(hex, new THREE.Color(hex))
  return parsedColors.get(hex)
}

const smoothstep = (edge0, edge1, value) => {
  const t = THREE.MathUtils.clamp((value - edge0) / (edge1 - edge0), 0, 1)
  return t * t * (3 - 2 * t)
}

/**
 * Cor de um vértice do relevo na paleta de um bioma (`palette`,
 * core/data/biomes/), pela altura acima da água e pela inclinação
 * (`normalY`, 1 = plano): fundo abaixo da água, margem logo acima, chão de
 * `low` a `high`, pico (se o bioma tiver) e encosta íngreme por cima.
 * Escreve em `target`.
 */
export function terrainColorAt(palette, heightAboveWater, normalY, target) {
  const { SHORE_HEIGHT, SLOPE_START, SLOPE_FULL } = GAME_CONFIG.TERRAIN_COLOR
  if (heightAboveWater < 0) {
    target.copy(colorOf(palette.bed))
  } else if (heightAboveWater < SHORE_HEIGHT) {
    target.copy(colorOf(palette.shore))
  } else {
    const t = smoothstep(SHORE_HEIGHT, palette.highHeight, heightAboveWater)
    target.copy(colorOf(palette.low)).lerp(colorOf(palette.high), t)
  }
  const steepness = smoothstep(SLOPE_START, SLOPE_FULL, normalY)
  target.lerp(colorOf(palette.slope), steepness)
  if (palette.peak) {
    // O pico cobre até a encosta (neve no alto do morro).
    const peak = smoothstep(
      palette.peakHeight,
      palette.peakHeight + SHORE_HEIGHT * 4,
      heightAboveWater,
    )
    target.lerp(colorOf(palette.peak), peak)
  }
  return target
}

const biomeColor = new THREE.Color()

/**
 * Cor de um vértice misturando a de cada bioma pelo peso dele no vértice
 * (`biomeWeights` do chunk) — a fronteira não tem recorte. No modo
 * `biome` (debug, F2), a cor chapada de cada bioma (`palette.debug`).
 */
function vertexColor(
  chunk,
  vertexIndex,
  heightAboveWater,
  normalY,
  mode,
  target,
) {
  const { biomeIds, biomeWeights } = chunk
  const first = vertexIndex * biomeIds.length
  // Os pesos guardados são arredondados: normaliza pela soma deles.
  let total = 0
  for (let biome = 0; biome < biomeIds.length; biome++) {
    total += biomeWeights[first + biome]
  }
  const color = biomeColor
  target.setRGB(0, 0, 0)
  for (let biome = 0; biome < biomeIds.length; biome++) {
    const weight = biomeWeights[first + biome] / total
    if (weight === 0) continue
    const { palette } = getBiome(biomeIds[biome])
    if (mode === TERRAIN_COLOR_MODES.biome) {
      color.copy(colorOf(palette.debug))
    } else {
      terrainColorAt(palette, heightAboveWater, normalY, color)
    }
    target.r += color.r * weight
    target.g += color.g * weight
    target.b += color.b * weight
  }
  return target
}

/**
 * Soma em `layerWeights` (um peso por camada de terrainLayers.js) as
 * camadas de desenho de um bioma num vértice, vezes `weight` (o peso do
 * bioma ali), pelas mesmas regras da cor (`terrainColorAt`): margem e fundo
 * da água (`shoreTexture`), encosta (`slopeTexture`) e pico (`peakTexture`).
 */
export function addGroundLayers(
  biome,
  heightAboveWater,
  normalY,
  weight,
  layerWeights,
) {
  const { palette, ground } = biome
  const { SHORE_HEIGHT, SLOPE_START, SLOPE_FULL } = GAME_CONFIG.TERRAIN_COLOR
  const base =
    heightAboveWater < SHORE_HEIGHT
      ? (ground.shoreTexture ?? ground.texture)
      : ground.texture
  const steepness = smoothstep(SLOPE_START, SLOPE_FULL, normalY)
  const peak = palette.peak
    ? smoothstep(
        palette.peakHeight,
        palette.peakHeight + SHORE_HEIGHT * 4,
        heightAboveWater,
      )
    : 0
  const add = (layer, share) => {
    layerWeights[terrainLayerIndex(layer)] += weight * share
  }
  add(base, (1 - steepness) * (1 - peak))
  add(ground.slopeTexture, steepness * (1 - peak))
  if (peak > 0) add(ground.peakTexture ?? ground.texture, peak)
}

/**
 * Atributos do desenho do chão por vértice (terrainMaterial.js): o peso de
 * cada camada (`groundLayers0`/`groundLayers1`, quatro em cada) e a força
 * do desenho (`groundDetail`, o `ground.detail` dos biomas pelo peso).
 */
function groundAttributes(chunk, side, vertex, positions, normals, waterLevel) {
  const { biomeIds, biomeWeights, resolution } = chunk
  const biomes = biomeIds.map((id) => getBiome(id))
  const layers0 = new Float32Array(side * side * 4)
  const layers1 = new Float32Array(side * side * 4)
  const detail = new Float32Array(side * side)
  const layerWeights = new Float32Array(MAX_TERRAIN_LAYERS)

  for (let ix = 0; ix < side; ix++) {
    for (let iz = 0; iz < side; iz++) {
      const i = vertex(ix, iz)
      const first = heightIndex(resolution, ix, iz) * biomeIds.length
      let total = 0
      for (let biome = 0; biome < biomeIds.length; biome++) {
        total += biomeWeights[first + biome]
      }
      layerWeights.fill(0)
      for (let biome = 0; biome < biomeIds.length; biome++) {
        const weight = biomeWeights[first + biome] / total
        if (weight === 0) continue
        addGroundLayers(
          biomes[biome],
          positions[i * 3 + 1] - waterLevel,
          normals.getY(i),
          weight,
          layerWeights,
        )
        detail[i] += weight * biomes[biome].ground.detail
      }
      layers0.set(layerWeights.subarray(0, 4), i * 4)
      layers1.set(layerWeights.subarray(4, 8), i * 4)
    }
  }
  return { layers0, layers1, detail }
}

/**
 * Geometria de um chunk (`TerrainChunk`, core/terrain/terrainChunk.js) em
 * coordenadas de mundo, com a MESMA triangulação do colisor heightfield:
 * cada célula corta na diagonal do canto `+x,-z` ao `-x,+z` — o que se vê é
 * o que se pisa. Cor por vértice pelos biomas (`vertexColor`); `mode` é um
 * de `TERRAIN_COLOR_MODES`. Os atributos `groundLayers0/1` e
 * `groundDetail` são o desenho do chão (`groundAttributes`,
 * terrainMaterial.js). Quem cria é dono do `dispose()` (regra 5.3).
 */
export function buildTerrainChunkGeometry(
  chunk,
  waterLevel,
  mode = TERRAIN_COLOR_MODES.natural,
) {
  const { resolution, heights, minX, minZ } = chunk
  const side = resolution + 1
  const step = chunk.size / resolution
  const vertex = (ix, iz) => iz * side + ix

  const positions = new Float32Array(side * side * 3)
  for (let ix = 0; ix < side; ix++) {
    for (let iz = 0; iz < side; iz++) {
      const offset = vertex(ix, iz) * 3
      positions[offset] = minX + ix * step
      positions[offset + 1] = heights[heightIndex(resolution, ix, iz)]
      positions[offset + 2] = minZ + iz * step
    }
  }

  const indices = []
  for (let ix = 0; ix < resolution; ix++) {
    for (let iz = 0; iz < resolution; iz++) {
      const a = vertex(ix, iz)
      const b = vertex(ix + 1, iz)
      const c = vertex(ix, iz + 1)
      const d = vertex(ix + 1, iz + 1)
      indices.push(a, c, b, b, c, d)
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()

  const normals = geometry.getAttribute('normal')
  const colors = new Float32Array(side * side * 3)
  const color = new THREE.Color()
  for (let ix = 0; ix < side; ix++) {
    for (let iz = 0; iz < side; iz++) {
      const i = vertex(ix, iz)
      vertexColor(
        chunk,
        heightIndex(resolution, ix, iz),
        positions[i * 3 + 1] - waterLevel,
        normals.getY(i),
        mode,
        color,
      )
      colors[i * 3] = color.r
      colors[i * 3 + 1] = color.g
      colors[i * 3 + 2] = color.b
    }
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  const ground = groundAttributes(
    chunk,
    side,
    vertex,
    positions,
    normals,
    waterLevel,
  )
  geometry.setAttribute(
    'groundLayers0',
    new THREE.BufferAttribute(ground.layers0, 4),
  )
  geometry.setAttribute(
    'groundLayers1',
    new THREE.BufferAttribute(ground.layers1, 4),
  )
  geometry.setAttribute(
    'groundDetail',
    new THREE.BufferAttribute(ground.detail, 1),
  )
  geometry.computeBoundingSphere()

  return geometry
}
