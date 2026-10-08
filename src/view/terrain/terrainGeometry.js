import * as THREE from 'three'
import { heightIndex } from '@/core/terrain/terrainChunk'
import { TERRAIN_PALETTE } from './terrainPalette'

const colorOf = (hex) => new THREE.Color(hex)

const smoothstep = (edge0, edge1, value) => {
  const t = THREE.MathUtils.clamp((value - edge0) / (edge1 - edge0), 0, 1)
  return t * t * (3 - 2 * t)
}

/**
 * Cor de um vértice do relevo pela altura acima da água e pela inclinação
 * (`normalY`, 1 = plano). Escreve em `target`.
 */
export function terrainColorAt(heightAboveWater, normalY, target) {
  const palette = TERRAIN_PALETTE
  if (heightAboveWater < 0) {
    target.copy(colorOf(palette.lakeBed))
  } else if (heightAboveWater < palette.SHORE_HEIGHT) {
    target.copy(colorOf(palette.shore))
  } else {
    const t = smoothstep(
      palette.SHORE_HEIGHT,
      palette.GRASS_TOP_HEIGHT,
      heightAboveWater,
    )
    target.copy(colorOf(palette.lowGrass)).lerp(colorOf(palette.highGrass), t)
  }
  const steepness = smoothstep(palette.SLOPE_START, palette.SLOPE_FULL, normalY)
  return target.lerp(colorOf(palette.slope), steepness)
}

/**
 * Geometria de um chunk (`TerrainChunk`, core/terrain/terrainChunk.js) em
 * coordenadas de mundo, com a MESMA triangulação do colisor heightfield:
 * cada célula corta na diagonal do canto `+x,-z` ao `-x,+z` — o que se vê é
 * o que se pisa. Cor por vértice (`terrainColorAt`). Quem cria é dono do
 * `dispose()` (regra 5.3).
 */
export function buildTerrainChunkGeometry(chunk, waterLevel) {
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
  for (let i = 0; i < side * side; i++) {
    terrainColorAt(positions[i * 3 + 1] - waterLevel, normals.getY(i), color)
    colors[i * 3] = color.r
    colors[i * 3 + 1] = color.g
    colors[i * 3 + 2] = color.b
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  geometry.computeBoundingSphere()

  return geometry
}
