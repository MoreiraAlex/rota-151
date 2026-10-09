import * as THREE from 'three'
import { GAME_CONFIG } from '@/core/gameConfig'
import { WIND_SHADER, vegetationUniforms } from './windShader'

// Cor da luz que passa pela folha e do brilho de borda (as do
// stylized-scene).
const TRANSLUCENCY_COLOR = '#cfe06a'
const RIM_COLOR = '#eaf2c0'

const VERTEX_HEADER = /* glsl */ `
${WIND_SHADER}
uniform float uBladeHeight;
uniform float uFaceCamera;
uniform float uHeightVariation;
uniform float uHeightPatch;
// Por tufo: origem no mundo (xz) e giro (cos, sin); cores do bioma.
attribute vec4 aGrass;
attribute vec3 aRootA;
attribute vec3 aTipA;
attribute vec3 aRootB;
attribute vec3 aTipB;
// Por vértice: raiz (xyz) e giro (w) da folha dele (bladePivotsOf).
attribute vec4 aBlade;
varying float vGrassHeight;
varying float vGrassSeed;
varying vec3 vGrassWorld;
varying vec3 vRootA;
varying vec3 vTipA;
varying vec3 vRootB;
varying vec3 vTipB;
`

// Cada folha gira em volta da raiz para ficar de frente para a câmera (vista
// de lado, a folha é um risco e a grama parece sumir); depois dobra com o
// vento e a altura varia em manchas.
const VERTEX_BEGIN = /* glsl */ `
#include <begin_vertex>
vec3 bladeWorld = (modelMatrix * instanceMatrix * vec4(aBlade.xyz, 1.0)).xyz;
vec3 bladeToCamera = transpose(mat3(modelMatrix * instanceMatrix))
  * vec3(cameraPosition.x - bladeWorld.x, 0.0, cameraPosition.z - bladeWorld.z);
// Folha de dois lados: no máximo um quarto de volta.
float bladeTurn = mod(atan(bladeToCamera.z, bladeToCamera.x) - aBlade.w + 1.5707963,
  3.1415927) - 1.5707963;
bladeTurn *= uFaceCamera;
vec2 bladeArm = transformed.xz - aBlade.xz;
transformed.xz = aBlade.xz + vec2(
  bladeArm.x * cos(bladeTurn) - bladeArm.y * sin(bladeTurn),
  bladeArm.x * sin(bladeTurn) + bladeArm.y * cos(bladeTurn));
vec2 grassOrigin = aGrass.xy;
float grassSeed = vegHash(grassOrigin);
vGrassHeight = clamp(transformed.y / uBladeHeight, 0.0, 1.0);
vGrassSeed = grassSeed;
float heightNoise = vegNoise(grassOrigin / uHeightPatch + vec2(53.0, 17.0)) * 2.0 - 1.0;
float heightFactor = clamp(1.0 + heightNoise * uHeightVariation, 0.2, 1.8);
transformed += vegGrassSway(transformed.y, uBladeHeight, grassOrigin, aGrass.zw,
  grassSeed, uTurbulence, uFlutter, 1.5, 0.25, 0.18);
transformed.y *= heightFactor;
vGrassWorld = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
vRootA = aRootA;
vTipA = aTipA;
vRootB = aRootB;
vTipB = aTipB;
`

// A folha é um cartão de dois lados: a normal vai para o hemisfério do céu
// (os dois lados recebem a mesma luz, o de trás não fica preto).
const VERTEX_NORMAL = /* glsl */ `
#include <normal_vertex>
vec3 grassWorldNormal = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * objectNormal);
grassWorldNormal.y = abs(grassWorldNormal.y);
vNormal = normalize((viewMatrix * vec4(grassWorldNormal, 0.0)).xyz);
`

const FRAGMENT_HEADER = /* glsl */ `
${WIND_SHADER}
uniform float uColorPatch;
uniform float uColorVariation;
uniform float uMacroVariation;
uniform float uMacroSize;
uniform float uBaseShade;
uniform float uTranslucency;
uniform float uRim;
uniform vec3 uTranslucencyColor;
uniform vec3 uRimColor;
uniform vec3 uSunDirection;
uniform float uSunGlow;
varying float vGrassHeight;
varying float vGrassSeed;
varying vec3 vGrassWorld;
varying vec3 vRootA;
varying vec3 vTipA;
varying vec3 vRootB;
varying vec3 vTipB;
`

// Cor: da raiz à ponta, em manchas entre os pares A e B, com variação de
// brilho por tufo, manchas grandes de claro e escuro e a base escurecida.
const FRAGMENT_COLOR = /* glsl */ `
#include <color_fragment>
float grassT = pow(vGrassHeight, 1.4);
vec3 gradientA = mix(vRootA, vTipA, grassT);
vec3 gradientB = mix(vRootB, vTipB, grassT);
float patchBlend = clamp(vegNoise(vGrassWorld.xz / uColorPatch) * uColorVariation, 0.0, 1.0);
vec3 grassColor = mix(gradientA, gradientB, patchBlend);
float brightness = mix(0.85, 1.15, fract(vGrassSeed * 13.37));
float macro = 1.0 + (vegNoise(vGrassWorld.xz / uMacroSize + vec2(137.0, 91.0)) - 0.5) * 2.0 * uMacroVariation;
float baseShade = mix(1.0 - uBaseShade, 1.0, smoothstep(0.05, 0.6, vGrassHeight));
diffuseColor.rgb = grassColor * brightness * macro * baseShade;
`

// Desfaz a troca de lado da normal do material de dois lados.
const FRAGMENT_NORMAL = /* glsl */ `
#include <normal_fragment_begin>
normal = normalize(vNormal);
`

// Luz do sol atravessando a folha (contra o sol, nas pontas) e brilho de
// borda — somados como emissão.
const FRAGMENT_EMISSIVE = /* glsl */ `
#include <emissivemap_fragment>
vec3 grassViewDir = normalize(vViewPosition);
vec3 grassSun = normalize((viewMatrix * vec4(uSunDirection, 0.0)).xyz);
vec3 grassThrough = normalize(grassSun + normal * 0.5);
float backLight = pow(max(dot(grassViewDir, -grassThrough), 0.0), 3.0);
totalEmissiveRadiance += uTranslucencyColor * backLight * pow(vGrassHeight, 1.5)
  * uTranslucency * uSunGlow;
float fresnel = pow(1.0 - max(dot(normal, grassViewDir), 0.0), 4.0);
totalEmissiveRadiance += uRimColor * fresnel * uRim * max(uSunGlow, 0.15);
`

/**
 * Material da grama (docs/features/049-vegetacao-e-floresta.md), portado
 * do `grass-material.ts` do stylized-scene: `MeshLambertMaterial` (recebe
 * sol, ambiente, sombra e névoa do jogo; Lambert e não PBR — é a parte que
 * mais cobre a tela, e o custo por pixel pesava) com o vento, a cor e a luz da
 * folha injetados no shader. Atributos por tufo: `aGrass` e as quatro
 * cores (`buildGrassTile`); por vértice, `aBlade` (`bladePivotsOf`). Os
 * números são de `GAME_CONFIG.GRASS` (`applyGrassLook`, a cada quadro). Quem cria chama `dispose()`.
 *
 * @param {number} bladeHeight - altura do modelo do tufo (antes da escala)
 */
export function createGrassMaterial(bladeHeight) {
  const uniforms = {
    uBladeHeight: { value: bladeHeight },
    uFaceCamera: { value: 0 },
    uHeightVariation: { value: 0 },
    uHeightPatch: { value: 1 },
    uColorPatch: { value: 1 },
    uColorVariation: { value: 0 },
    uMacroVariation: { value: 0 },
    uMacroSize: { value: 1 },
    uBaseShade: { value: 0 },
    uTranslucency: { value: 0 },
    uRim: { value: 0 },
    uTranslucencyColor: { value: new THREE.Color(TRANSLUCENCY_COLOR) },
    uRimColor: { value: new THREE.Color(RIM_COLOR) },
  }

  const material = new THREE.MeshLambertMaterial({ side: THREE.DoubleSide })
  material.userData.grassUniforms = uniforms
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, vegetationUniforms, uniforms)
    shader.vertexShader = (VERTEX_HEADER + shader.vertexShader)
      .replace('#include <begin_vertex>', VERTEX_BEGIN)
      .replace('#include <normal_vertex>', VERTEX_NORMAL)
    shader.fragmentShader = (FRAGMENT_HEADER + shader.fragmentShader)
      .replace('#include <color_fragment>', FRAGMENT_COLOR)
      .replace('#include <normal_fragment_begin>', FRAGMENT_NORMAL)
      .replace('#include <emissivemap_fragment>', FRAGMENT_EMISSIVE)
  }
  material.customProgramCacheKey = () => 'vegetation-grass'
  applyGrassLook(material)
  return material
}

/** Passa os números de `GAME_CONFIG.GRASS` para o material. */
export function applyGrassLook(material, grass = GAME_CONFIG.GRASS) {
  const uniforms = material.userData.grassUniforms
  uniforms.uFaceCamera.value = grass.FACE_CAMERA
  uniforms.uHeightVariation.value = grass.HEIGHT_VARIATION
  uniforms.uHeightPatch.value = grass.HEIGHT_PATCH_SIZE
  uniforms.uColorPatch.value = grass.COLOR_PATCH_SIZE
  uniforms.uColorVariation.value = grass.COLOR_VARIATION
  uniforms.uMacroVariation.value = grass.MACRO_VARIATION
  uniforms.uMacroSize.value = grass.MACRO_SIZE
  uniforms.uBaseShade.value = grass.BASE_SHADE
  uniforms.uTranslucency.value = grass.TRANSLUCENCY
  uniforms.uRim.value = grass.RIM
}
