import * as THREE from 'three'

/**
 * A água do mapa de uma cidade copiada (docs/features/069-revisao-do-
 * bioma-cidade.md — o mar ao sul de Pallet e o braço de água dele), no
 * espaço do modelo (o grupo do mapa põe no lugar e na escala): uma grade
 * plana na superfície do mar sobre a grade do chão (`colliders.ground`),
 * das linhas que têm água até a borda sul do mapa, e daí um pedaço de mar
 * fundo até `reach` m além dela (o horizonte; as paredes da borda não
 * deixam chegar) — sem ele com `reach` zero (o laguinho de Viridian, que
 * não encosta na borda). Os atributos são os da água dos rios (`waterGeometry.js`,
 * o mesmo material): a profundidade (`waterDepth`, m no mundo — vezes
 * `scale`; negativa onde o chão passa da água, que o material recorta) e a
 * correnteza (`waterFlow`, zero). Sem água: `null`. Quem cria é dono do
 * `dispose()` (regra 5.3).
 *
 * @param {object} colliders - `townMapCollidersOf` do mapa
 * @param {number} scale - o tamanho do mapa
 * @param {number} shoreReach - até quantos m acima da água a grade vai (a
 *   onda da margem sobe na terra)
 * @param {number} reach - quanto (m do modelo) o mar passa da borda sul
 * @param {number} deepDepth - a profundidade (m) do mar além da borda
 * @returns {THREE.BufferGeometry | null}
 */
export function buildTownMapWaterGeometry(
  colliders,
  scale,
  shoreReach,
  reach,
  deepDepth,
) {
  const { ground, water } = colliders
  if (!water) return null
  const { nx, nz, minX, minZ, step, heights } = ground
  // A primeira linha (de norte para sul) com água.
  let firstRow = nz
  for (let ix = 0; ix < nx; ix++) {
    for (let iz = 0; iz < firstRow; iz++) {
      if (water.cells[iz + ix * nz] === '1') firstRow = iz
    }
  }
  if (firstRow === nz) return null
  // As linhas da grade e, depois da última, a do mar além da borda.
  const hasBeyond = reach > 0
  const rows = nz - firstRow + (hasBeyond ? 1 : 0)
  const vertex = (ix, row) => row + ix * rows
  const positions = new Float32Array(nx * rows * 3)
  const depths = new Float32Array(nx * rows)
  for (let ix = 0; ix < nx; ix++) {
    for (let row = 0; row < rows; row++) {
      const i = vertex(ix, row)
      const isBeyond = hasBeyond && row === rows - 1
      const iz = firstRow + row
      const z = isBeyond ? minZ + (nz - 1) * step + reach : minZ + iz * step
      positions.set([minX + ix * step, water.surface, z], i * 3)
      depths[i] = isBeyond
        ? deepDepth
        : (water.surface - heights[iz + ix * nz]) * scale
    }
  }
  const indices = []
  for (let ix = 0; ix < nx - 1; ix++) {
    for (let row = 0; row < rows - 1; row++) {
      const corners = [
        vertex(ix, row),
        vertex(ix + 1, row),
        vertex(ix, row + 1),
        vertex(ix + 1, row + 1),
      ]
      if (corners.every((i) => depths[i] <= -shoreReach)) continue
      const [a, b, c, d] = corners
      indices.push(a, c, b, b, c, d)
    }
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('waterDepth', new THREE.BufferAttribute(depths, 1))
  geometry.setAttribute(
    'waterFlow',
    new THREE.BufferAttribute(new Float32Array(nx * rows * 2), 2),
  )
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  geometry.computeBoundingSphere()
  return geometry
}
