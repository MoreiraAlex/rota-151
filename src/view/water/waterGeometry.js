import * as THREE from 'three'
import { heightIndex } from '@/core/terrain/terrainChunk'

/**
 * Superfície da água de um chunk (docs/features/049-vegetacao-e-
 * floresta.md): uma grade plana no nível da água com a mesma resolução do
 * relevo, só nas células onde algum canto do chão fica abaixo dela. Cada
 * vértice leva a profundidade ali (`waterDepth`, m; negativa onde o chão
 * passa da água — o material recorta). Chunk sem chão abaixo da água:
 * `null`. Quem cria é dono do `dispose()` (regra 5.3).
 *
 * @param {import('@/core/terrain/terrainChunk').TerrainChunk} chunk
 * @param {number} waterLevel
 * @returns {THREE.BufferGeometry | null}
 */
export function buildWaterChunkGeometry(chunk, waterLevel) {
  if (chunk.minHeight >= waterLevel) return null
  const { resolution, heights, minX, minZ } = chunk
  const side = resolution + 1
  const step = chunk.size / resolution
  const vertex = (ix, iz) => iz * side + ix

  const positions = new Float32Array(side * side * 3)
  const depths = new Float32Array(side * side)
  for (let ix = 0; ix < side; ix++) {
    for (let iz = 0; iz < side; iz++) {
      const i = vertex(ix, iz)
      positions.set([minX + ix * step, waterLevel, minZ + iz * step], i * 3)
      depths[i] = waterLevel - heights[heightIndex(resolution, ix, iz)]
    }
  }

  const indices = []
  for (let ix = 0; ix < resolution; ix++) {
    for (let iz = 0; iz < resolution; iz++) {
      const corners = [
        vertex(ix, iz),
        vertex(ix + 1, iz),
        vertex(ix, iz + 1),
        vertex(ix + 1, iz + 1),
      ]
      if (corners.every((i) => depths[i] <= 0)) continue
      const [a, b, c, d] = corners
      indices.push(a, c, b, b, c, d)
    }
  }
  if (indices.length === 0) return null

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('waterDepth', new THREE.BufferAttribute(depths, 1))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  geometry.computeBoundingSphere()
  return geometry
}
