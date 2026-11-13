import * as THREE from 'three'
import { fountainsOfChunk } from '@/core/town/fountains'

// Quantos lados tem o disco da água de cada fonte.
const SEGMENTS = 32

/** A água das fontes das praças do chunk (`core/town/fountains.js`). */
export const fountainsOf = fountainsOfChunk

/**
 * A água dentro das fontes (docs/features/069-revisao-do-bioma-cidade.md;
 * `fountains`, a forma de `FountainWater`): um disco por fonte, na altura
 * da superfície dela. Os atributos são os da água dos rios
 * (`waterGeometry.js`), para o mesmo material: a profundidade que a cor lê
 * (`waterDepth`) vai da `water.colorDepth` no meio à `water.edgeDepth` na
 * beira (a espuma aparece no raso) e a correnteza (`waterFlow`) é zero. Sem
 * fonte: `null`. Quem cria é dono do `dispose()` (regra 5.3).
 *
 * @param {import('@/core/town/fountains').FountainWater[]} fountains
 * @returns {THREE.BufferGeometry | null}
 */
export function buildFountainWaterGeometry(fountains) {
  if (fountains.length === 0) return null
  const perFountain = SEGMENTS + 1
  const positions = new Float32Array(fountains.length * perFountain * 3)
  const depths = new Float32Array(fountains.length * perFountain)
  const flows = new Float32Array(fountains.length * perFountain * 2)
  const indices = []
  fountains.forEach(({ x, z, radius, surface, water }, f) => {
    const first = f * perFountain
    positions.set([x, surface, z], first * 3)
    depths[first] = water.colorDepth
    for (let k = 0; k < SEGMENTS; k++) {
      const angle = (k / SEGMENTS) * Math.PI * 2
      const i = first + 1 + k
      positions.set(
        [x + Math.cos(angle) * radius, surface, z + Math.sin(angle) * radius],
        i * 3,
      )
      depths[i] = water.edgeDepth
      // O centro, o próximo da volta e este: virado para cima (+Y).
      indices.push(first, first + 1 + ((k + 1) % SEGMENTS), i)
    }
  })
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('waterDepth', new THREE.BufferAttribute(depths, 1))
  geometry.setAttribute('waterFlow', new THREE.BufferAttribute(flows, 2))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  geometry.computeBoundingSphere()
  return geometry
}
