import * as THREE from 'three'

/**
 * Material do relevo distante (docs/features/051-montanha.md): Lambert com
 * a cor por vértice, enevoado como o resto. Dois recortes no fragmento:
 *
 * - onde o chunk de verdade está carregado (a máscara `uLoadedMask`, um
 *   texel por chunk em volta do centro da malha) — a malha grossa ficaria
 *   por cima do chão nos vales;
 * - fora do círculo de raio `uRadius` em volta do centro (a borda da malha
 *   não aparece quadrada; a névoa já fechou ali).
 */

const VERTEX_HEAD = /* glsl */ `#include <common>
varying vec2 vFarXZ;`

const VERTEX_POSITION = /* glsl */ `#include <begin_vertex>
vFarXZ = (modelMatrix * vec4(transformed, 1.0)).xz;`

const FRAGMENT_HEAD = /* glsl */ `#include <common>
varying vec2 vFarXZ;
uniform sampler2D uLoadedMask;
uniform vec2 uMaskOrigin;
uniform float uMaskSize;
uniform float uChunkSize;
uniform vec2 uCenter;
uniform float uRadius;`

const FRAGMENT_CUT = /* glsl */ `void main() {
  if (distance(vFarXZ, uCenter) > uRadius) discard;
  vec2 chunk = floor(vFarXZ / uChunkSize + 0.5) - uMaskOrigin;
  if (all(greaterThanEqual(chunk, vec2(0.0))) &&
      all(lessThan(chunk, vec2(uMaskSize)))) {
    if (texture2D(uLoadedMask, (chunk + 0.5) / uMaskSize).r > 0.5) discard;
  }`

/**
 * Máscara de chunks carregados: `size × size` texels, um por chunk.
 */
export function createLoadedMask(size) {
  const texture = new THREE.DataTexture(
    new Uint8Array(size * size),
    size,
    size,
    THREE.RedFormat,
    THREE.UnsignedByteType,
  )
  texture.magFilter = THREE.NearestFilter
  texture.minFilter = THREE.NearestFilter
  texture.needsUpdate = true
  return texture
}

/**
 * Marca na máscara os chunks carregados (`chunks`, com `chunkX`/`chunkZ`),
 * a partir do chunk `(originX, originZ)` no texel 0.
 */
export function fillLoadedMask(texture, chunks, originX, originZ) {
  const { data, width: size } = texture.image
  data.fill(0)
  for (const { chunkX, chunkZ } of chunks) {
    const x = chunkX - originX
    const z = chunkZ - originZ
    if (x < 0 || z < 0 || x >= size || z >= size) continue
    data[z * size + x] = 255
  }
  texture.needsUpdate = true
}

/**
 * @param {THREE.DataTexture} mask - de `createLoadedMask`
 * @returns {THREE.MeshLambertMaterial} com `userData.farUniforms`
 */
export function createFarTerrainMaterial(mask) {
  const uniforms = {
    uLoadedMask: { value: mask },
    uMaskOrigin: { value: new THREE.Vector2() },
    uMaskSize: { value: mask.image.width },
    uChunkSize: { value: 1 },
    uCenter: { value: new THREE.Vector2() },
    uRadius: { value: 0 },
  }
  const material = new THREE.MeshLambertMaterial({ vertexColors: true })
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms)
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', VERTEX_HEAD)
      .replace('#include <begin_vertex>', VERTEX_POSITION)
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', FRAGMENT_HEAD)
      .replace('void main() {', FRAGMENT_CUT)
  }
  material.customProgramCacheKey = () => 'far-terrain'
  material.userData.farUniforms = uniforms
  return material
}
