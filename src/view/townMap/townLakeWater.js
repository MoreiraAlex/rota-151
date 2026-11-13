import * as THREE from 'three'

// Lado (m) de cada quadrado da grade da água.
const STEP = 0.5
// Quanto (m) a grade passa do retângulo do lago (a beira, que o material
// recorta onde o chão passa da água).
const MARGIN = 1

/**
 * A água do lago da cidade montada à mão (docs/features/069-revisao-do-
 * bioma-cidade.md — o laguinho de Viridian), no mundo: uma grade plana na
 * superfície dele (`lake.surface`) sobre o retângulo do lago com uma
 * margem. Os atributos são os da água dos rios (`waterGeometry.js`, o
 * mesmo material): a profundidade (`waterDepth`, a superfície menos o chão
 * de `heightAt`; negativa onde o chão passa da água, que o material
 * recorta) e a correnteza (`waterFlow`, zero: água parada). Sem lago:
 * `null`. Quem cria é dono do `dispose()` (regra 5.3).
 *
 * @param {{ rect: number[], surface: number } | null} lake - o
 *   `fixedTown.lake`
 * @param {(x: number, z: number) => number} heightAt - o chão (m)
 * @param {number} shoreReach - até quantos m acima da água a grade vai (a
 *   onda da margem sobe na terra)
 * @returns {THREE.BufferGeometry | null}
 */
export function buildTownLakeWaterGeometry(lake, heightAt, shoreReach) {
  if (!lake) return null
  const [minX, minZ, maxX, maxZ] = lake.rect
  const x0 = minX - MARGIN
  const z0 = minZ - MARGIN
  const nx = Math.ceil((maxX - minX + 2 * MARGIN) / STEP) + 1
  const nz = Math.ceil((maxZ - minZ + 2 * MARGIN) / STEP) + 1
  const vertex = (ix, iz) => iz + ix * nz
  const positions = new Float32Array(nx * nz * 3)
  const depths = new Float32Array(nx * nz)
  for (let ix = 0; ix < nx; ix++) {
    for (let iz = 0; iz < nz; iz++) {
      const x = x0 + ix * STEP
      const z = z0 + iz * STEP
      const i = vertex(ix, iz)
      positions.set([x, lake.surface, z], i * 3)
      depths[i] = lake.surface - heightAt(x, z)
    }
  }
  const indices = []
  for (let ix = 0; ix < nx - 1; ix++) {
    for (let iz = 0; iz < nz - 1; iz++) {
      const corners = [
        vertex(ix, iz),
        vertex(ix + 1, iz),
        vertex(ix, iz + 1),
        vertex(ix + 1, iz + 1),
      ]
      if (corners.every((i) => depths[i] <= -shoreReach)) continue
      const [a, b, c, d] = corners
      indices.push(a, c, b, b, c, d)
    }
  }
  if (indices.length === 0) return null
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('waterDepth', new THREE.BufferAttribute(depths, 1))
  geometry.setAttribute(
    'waterFlow',
    new THREE.BufferAttribute(new Float32Array(nx * nz * 2), 2),
  )
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  geometry.computeBoundingSphere()
  return geometry
}
