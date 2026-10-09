import * as THREE from 'three'
import { GAME_CONFIG } from '@/core/gameConfig'
import { WIND_SHADER, vegetationUniforms } from './windShader'

const VERTEX_HEADER = /* glsl */ `
${WIND_SHADER}
uniform float uCanopyBaseY;
uniform float uCanopyHeight;
uniform float uCanopyRadius;
uniform float uSway;
uniform float uInnerShade;
uniform float uTopLight;
uniform float uLeafTranslucency;
uniform vec3 uSunDirection;
uniform float uSunGlow;
// Por copa: origem no mundo (xz) e giro (cos, sin); centro da copa no
// mundo (para a normal esférica).
attribute vec4 aWind;
attribute vec3 aCenter;
// Volume da copa, por vértice (o cartão de folha é pequeno, e a copa
// empilha muitas camadas de folha recortada — conta por pixel pesava):
// tinta da folha, quanto do preenchimento da sombra fica e o sol que
// atravessa a folha.
varying vec3 vCanopyTint;
varying float vCanopyInner;
varying float vCanopyBack;
`

const VERTEX_BEGIN = /* glsl */ `
#include <begin_vertex>
float canopyHeight = clamp((transformed.y - uCanopyBaseY) / uCanopyHeight, 0.0, 1.0);
transformed += vegCanopySway(transformed, uCanopyBaseY, uCanopyHeight,
  aWind.xy, aWind.zw, vegHash(aWind.xy), uSway);
`

// Normal de esfera em volta do centro da copa: a copa vira um volume macio
// (claro do lado do sol, escurecendo em volta), sem cartão de folha
// destoando, igual dos dois lados e de qualquer ângulo. E o volume: o
// miolo escurece (folha atrás de folha), o alto clareia e esquenta (pega
// mais céu e sol), e a folha da borda vista contra o sol acende (como na
// grama).
const VERTEX_NORMAL = /* glsl */ `
#include <project_vertex>
vec3 canopyWorld = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
vec3 canopyOut = canopyWorld - aCenter;
vNormal = normalize((viewMatrix * vec4(normalize(canopyOut), 0.0)).xyz);
float canopyScale = length(instanceMatrix[0].xyz);
float canopyDepth = clamp(length(canopyOut) / (uCanopyRadius * canopyScale), 0.0, 1.0);
vCanopyInner = mix(1.0 - uInnerShade, 1.0, smoothstep(0.2, 0.95, canopyDepth));
float canopyTop = uTopLight * smoothstep(0.25, 1.0, canopyHeight);
vCanopyTint = vCanopyInner * (1.0 + canopyTop)
  * mix(vec3(1.0), vec3(1.06, 1.03, 0.82), canopyTop);
vec3 canopyView = normalize(cameraPosition - canopyWorld);
vCanopyBack = pow(max(dot(canopyView, -normalize(uSunDirection)), 0.0), 3.0)
  * smoothstep(0.6, 1.0, canopyDepth) * uLeafTranslucency * uSunGlow;
`

const FRAGMENT_HEADER = /* glsl */ `
varying vec3 vCanopyTint;
varying float vCanopyInner;
varying float vCanopyBack;
`

const FRAGMENT_COLOR = /* glsl */ `
#include <color_fragment>
diffuseColor.rgb *= vCanopyTint;
`

const FRAGMENT_NORMAL = /* glsl */ `
#include <normal_fragment_begin>
normal = normalize(vNormal);
`

// O preenchimento da sombra também escurece no miolo; o sol atravessando a
// folha vai na cor dela.
const FRAGMENT_EMISSIVE = /* glsl */ `
#include <emissivemap_fragment>
totalEmissiveRadiance = totalEmissiveRadiance * vCanopyInner
  + diffuseColor.rgb * vec3(1.15, 1.1, 0.6) * vCanopyBack;
`

function canopyUniforms(bounds) {
  return {
    uCanopyBaseY: { value: bounds.baseY },
    uCanopyHeight: { value: bounds.height },
    uCanopyRadius: { value: bounds.radius },
    uSway: { value: GAME_CONFIG.TREES.SWAY },
    uInnerShade: { value: GAME_CONFIG.TREES.INNER_SHADE },
    uTopLight: { value: GAME_CONFIG.TREES.TOP_LIGHT },
    uLeafTranslucency: { value: GAME_CONFIG.TREES.TRANSLUCENCY },
  }
}

/**
 * Material das copas (docs/features/049-vegetacao-e-floresta.md) — as
 * folhas das árvores e dos arbustos do MegaKit: cópia do material do
 * `.glb` (textura com recorte) com a normal esférica e o vento da copa
 * (`vegCanopySway`, como no stylized-scene), o volume (miolo escuro, alto
 * claro, sol atravessando a borda — a textura do pacote é uma cor chapada
 * só, o volume vem daqui) e a própria textura clareando a sombra
 * (`TREES.LEAF_FILL`). Junto vai o material da SOMBRA (`depth`), com o
 * mesmo vento e o mesmo recorte — a sombra das folhas balança junto.
 * `bounds` = base, altura e raio da copa no modelo. Quem cria chama
 * `dispose()` dos dois.
 */
export function createCanopyMaterials(source, bounds) {
  const uniforms = canopyUniforms(bounds)

  const material = source.clone()
  material.emissiveMap = material.map
  material.userData.canopyUniforms = uniforms
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, vegetationUniforms, uniforms)
    shader.vertexShader = (VERTEX_HEADER + shader.vertexShader)
      .replace('#include <begin_vertex>', VERTEX_BEGIN)
      .replace('#include <project_vertex>', VERTEX_NORMAL)
    shader.fragmentShader = (FRAGMENT_HEADER + shader.fragmentShader)
      .replace('#include <color_fragment>', FRAGMENT_COLOR)
      .replace('#include <normal_fragment_begin>', FRAGMENT_NORMAL)
      .replace('#include <emissivemap_fragment>', FRAGMENT_EMISSIVE)
  }
  material.customProgramCacheKey = () => 'vegetation-canopy'

  const depth = new THREE.MeshDepthMaterial({
    depthPacking: THREE.RGBADepthPacking,
    map: source.map,
    alphaTest: source.alphaTest,
    side: THREE.DoubleSide,
  })
  depth.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, vegetationUniforms, uniforms)
    shader.vertexShader = (VERTEX_HEADER + shader.vertexShader).replace(
      '#include <begin_vertex>',
      VERTEX_BEGIN,
    )
  }
  depth.customProgramCacheKey = () => 'vegetation-canopy-depth'

  applyCanopyLook(material)
  return { material, depth }
}

/**
 * Passa os números de `GAME_CONFIG.TREES` para o material: balanço, volume
 * e o preenchimento da sombra.
 */
export function applyCanopyLook(material) {
  const { SWAY, LEAF_FILL, INNER_SHADE, TOP_LIGHT, TRANSLUCENCY } =
    GAME_CONFIG.TREES
  const uniforms = material.userData.canopyUniforms
  uniforms.uSway.value = SWAY
  uniforms.uInnerShade.value = INNER_SHADE
  uniforms.uTopLight.value = TOP_LIGHT
  uniforms.uLeafTranslucency.value = TRANSLUCENCY
  // Na cor do material: numa folha branca tingida, o preenchimento também
  // fica da cor dela.
  material.emissive.copy(material.color).multiplyScalar(LEAF_FILL)
}
