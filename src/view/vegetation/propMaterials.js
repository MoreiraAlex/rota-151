import * as THREE from 'three'
import { GAME_CONFIG } from '@/core/gameConfig'
import { WIND_SHADER, vegetationUniforms } from './windShader'

/**
 * Materiais dos modelos do MegaKit na floresta (docs/features/049-
 * vegetacao-e-floresta.md): cópias do material do próprio `.glb` com um
 * pedaço de shader a mais. Quem cria chama `dispose()` (a textura é do
 * `.glb`, fica no cache do drei).
 */

const FOLIAGE_HEADER = /* glsl */ `
${WIND_SHADER}
uniform float uFoliageBase;
uniform float uFoliageHeight;
// Por planta: origem no mundo (xz) e giro (cos, sin).
attribute vec4 aWind;
`

// O mesmo vento da grama, um pouco mais duro (folha grande).
const FOLIAGE_BEGIN = /* glsl */ `
#include <begin_vertex>
transformed += vegGrassSway(transformed.y - uFoliageBase, uFoliageHeight,
  aWind.xy, aWind.zw, vegHash(aWind.xy), uTurbulence * 0.6, uFlutter * 0.5,
  1.6, 0.2, 0.1);
`

// Folha de dois lados: normal para o hemisfério do céu (como a grama).
const FOLIAGE_NORMAL = /* glsl */ `
#include <normal_vertex>
vec3 foliageNormal = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * objectNormal);
foliageNormal.y = abs(foliageNormal.y);
vNormal = normalize((viewMatrix * vec4(foliageNormal, 0.0)).xyz);
`

const FOLIAGE_FRAGMENT_NORMAL = /* glsl */ `
#include <normal_fragment_begin>
normal = normalize(vNormal);
`

/**
 * Cópia de `source` (o material de uma planta do `.glb`) balançando com o
 * vento da vegetação e clareada na sombra. `bounds`: base e altura do
 * modelo. Atributo por instância `aWind`.
 */
export function createFoliageMaterial(source, bounds) {
  const material = source.clone()
  // A textura também como emissão (`FOLIAGE_FILL`, `applyFoliageLook`): a
  // planta não some na sombra.
  material.emissiveMap = material.map
  const uniforms = {
    uFoliageBase: { value: bounds.baseY },
    uFoliageHeight: { value: bounds.height },
  }
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, vegetationUniforms, uniforms)
    shader.vertexShader = (FOLIAGE_HEADER + shader.vertexShader)
      .replace('#include <begin_vertex>', FOLIAGE_BEGIN)
      .replace('#include <normal_vertex>', FOLIAGE_NORMAL)
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <normal_fragment_begin>',
      FOLIAGE_FRAGMENT_NORMAL,
    )
  }
  material.customProgramCacheKey = () => 'vegetation-foliage'
  return material
}

/** Passa o preenchimento da sombra (`FOLIAGE_FILL`) para o material. */
export function applyFoliageLook(material) {
  material.emissive.setScalar(GAME_CONFIG.FOLIAGE_FILL)
}

/**
 * Cópia de `source` (a casca das árvores do `.glb`) com a própria textura
 * clareando a sombra (`TREES.TRUNK_FILL`, `applyBarkLook`).
 */
export function createBarkMaterial(source) {
  const material = source.clone()
  material.emissiveMap = material.map
  return material
}

export function applyBarkLook(material) {
  material.emissive
    .copy(material.color)
    .multiplyScalar(GAME_CONFIG.TREES.TRUNK_FILL)
}

const MOSS_VERTEX_HEADER = /* glsl */ `
// Por pedra: quanto do topo é musgo (0 a 1).
attribute float aMoss;
varying float vMoss;
varying float vMossUp;
`

const MOSS_VERTEX = /* glsl */ `
#include <normal_vertex>
vMoss = aMoss;
vMossUp = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * objectNormal).y;
`

const MOSS_FRAGMENT_HEADER = /* glsl */ `
uniform vec3 uMossColor;
varying float vMoss;
varying float vMossUp;
`

// Musgo onde a face olha para cima.
const MOSS_FRAGMENT = /* glsl */ `
#include <color_fragment>
diffuseColor.rgb = mix(diffuseColor.rgb, uMossColor,
  vMoss * smoothstep(0.35, 0.75, vMossUp));
`

/**
 * Cópia de `source` (o material das pedras do `.glb`) com musgo no topo,
 * pela força `aMoss` de cada instância (o `moss` do bioma).
 */
export function createMossyRockMaterial(source) {
  const material = source.clone()
  const uniforms = {
    uMossColor: { value: new THREE.Color(GAME_CONFIG.ROCKS.MOSS_COLOR) },
  }
  material.userData.mossUniforms = uniforms
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms)
    shader.vertexShader = (MOSS_VERTEX_HEADER + shader.vertexShader).replace(
      '#include <normal_vertex>',
      MOSS_VERTEX,
    )
    shader.fragmentShader = (
      MOSS_FRAGMENT_HEADER + shader.fragmentShader
    ).replace('#include <color_fragment>', MOSS_FRAGMENT)
  }
  material.customProgramCacheKey = () => 'vegetation-mossy-rock'
  return material
}

/** Passa a cor do musgo (`ROCKS.MOSS_COLOR`) para o material. */
export function applyMossLook(material) {
  material.userData.mossUniforms.uMossColor.value.set(
    GAME_CONFIG.ROCKS.MOSS_COLOR,
  )
}
