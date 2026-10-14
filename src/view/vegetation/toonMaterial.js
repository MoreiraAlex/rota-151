import * as THREE from 'three'
import { GAME_CONFIG } from '@/core/gameConfig'
import { withSeeThrough } from '@/view/materials/seeThrough'
import { GRASS_PUSH_SHADER, grassPushUniforms } from './grassPush'
import { WIND_SHADER, vegetationUniforms } from './windShader'

/**
 * Material "toon" dos modelos do Pokémon Let's Go
 * (docs/features/052-assets-do-lgpe-e-floresta.md): `MeshToonMaterial` (luz
 * em degrau pela rampa `gradientMap`) com o que o jogo original tem nos
 * materiais dele (os números vêm do `manifest.json`, scripts/lgpe/
 * pack-lgpe.js):
 *
 * - o lado sem sol puxa para uma **cor de sombra** (`LGPE.SHADOW_TINT`) em
 *   vez de só escurecer;
 * - **luz de borda** na cor do material (`RimColor` do jogo), apagando com
 *   o sol (`uSunGlow`);
 * - a **cor por vértice** do modelo (sombreado pintado), com força ajustável;
 * - o **vento** da vegetação (`windShader.js`, o mesmo de todo o resto):
 *   as plantas dobram como as do MegaKit (`vegGrassSway`) e as árvores
 *   balançam como as copas (`vegCanopySway`, com o pé parado) — sem
 *   número próprio, só o vento (`sway` no `createToonMaterial`);
 * - as **plantas abrindo** para quem passa (`push`, grassPush.js): mato,
 *   tufos, flores, arbustos e plantas largas dobram para longe do
 *   treinador e das criaturas pelo
 *   mapa do empurrão (deitam e levantam devagar), na mesma dobra em arco
 *   do vento, e tremem um pouco com a passada;
 * - nas árvores redondas (`FieldTreeShader04/05`), a cor vem de uma
 *   **rampa** (`rampMap`) lida pelo segundo UV (a altura na copa), vezes o
 *   sombreado (`shadeMap`), mais o detalhe escuro da textura de base (que
 *   só recorta as folhas);
 * - o **ver-através** (`view/materials/seeThrough.js`): entre a câmera e
 *   o alvo, some em pontilhado.
 *
 * Os números do `GAME_CONFIG.LGPE` valem para todos de uma vez
 * (`toonUniforms`, os mesmos objetos em todos — `applyToonLook` a cada
 * quadro).
 */

export const toonUniforms = {
  uShadowTint: { value: new THREE.Color() },
  uRimStrength: { value: 0 },
  uVertexColor: { value: 1 },
}

const RAMP_SIZE = 256
const rampData = new Uint8Array(RAMP_SIZE * 4)
const toonRamp = new THREE.DataTexture(rampData, RAMP_SIZE, 1)
toonRamp.minFilter = THREE.LinearFilter
toonRamp.magFilter = THREE.LinearFilter
toonRamp.generateMipmaps = false
const rampState = { threshold: null, softness: null }

/** Refaz a rampa: o degrau da luz em `threshold` (0 a 1), `softness` de largura. */
function setToonRamp(threshold, softness) {
  if (rampState.threshold === threshold && rampState.softness === softness) {
    return
  }
  rampState.threshold = threshold
  rampState.softness = softness
  const edge = Math.max(softness, 0.001)
  for (let i = 0; i < RAMP_SIZE; i++) {
    const x = i / (RAMP_SIZE - 1)
    const t = Math.min(1, Math.max(0, (x - threshold + edge) / (2 * edge)))
    const value = Math.round(t * t * (3 - 2 * t) * 255)
    rampData.set([value, value, value, 255], i * 4)
  }
  toonRamp.needsUpdate = true
}

const VERTEX_HEADER = /* glsl */ `
${WIND_SHADER}
uniform float uVertexColor;
uniform float uSwayHeight;
#if defined(LGPE_SWAY_PLANT) || defined(LGPE_SWAY_TREE)
// Por instância: origem no mundo (xz) e giro (cos, sin).
attribute vec4 aWind;
#endif
#ifdef LGPE_RAMP
attribute vec2 uv1;
varying vec2 vRampUv;
#endif
#if defined(LGPE_PUSH) && defined(USE_INSTANCING)
${GRASS_PUSH_SHADER}
#endif
`

const FRAGMENT_HEADER = /* glsl */ `
uniform float uRimStrength;
uniform float uSunGlow;
uniform vec3 uRimColor;
uniform float uRimMin;
uniform float uRimMax;
#ifdef LGPE_RAMP
uniform sampler2D uRampMap;
uniform sampler2D uShadeMap;
uniform float uShadeAmount;
varying vec2 vRampUv;
#endif
`

const GRADIENT = /* glsl */ `
#ifdef USE_GRADIENTMAP
uniform sampler2D gradientMap;
#endif
uniform vec3 uShadowTint;
vec3 getGradientIrradiance(vec3 normal, vec3 lightDirection) {
  float dotNL = dot(normal, lightDirection);
  vec2 coord = vec2(dotNL * 0.5 + 0.5, 0.0);
  #ifdef USE_GRADIENTMAP
  float ramp = texture2D(gradientMap, coord).r;
  #else
  float ramp = step(0.5, coord.x);
  #endif
  return mix(uShadowTint, vec3(1.0), ramp);
}
`

const COLOR_VERTEX = /* glsl */ `
#if defined(USE_COLOR) || defined(USE_INSTANCING_COLOR)
vColor = vec4(1.0);
#endif
#ifdef USE_COLOR
vColor.rgb *= mix(vec3(1.0), color.rgb, uVertexColor);
#endif
#ifdef USE_INSTANCING_COLOR
vColor.rgb *= instanceColor.rgb;
#endif
`

// Planta: a mesma dobra das plantas do MegaKit (propMaterials.js). Árvore:
// o balanço das copas, crescendo do pé (parado) ao topo.
const SWAY = /* glsl */ `
#include <begin_vertex>
#ifdef LGPE_SWAY_PLANT
vec3 swayRest = transformed;
transformed += vegGrassSway(transformed.y, uSwayHeight, aWind.xy, aWind.zw,
  vegHash(aWind.xy), uTurbulence * 0.6, uFlutter * 0.5, 1.6, 0.2, 0.1);
#if defined(LGPE_PUSH) && defined(USE_INSTANCING)
#ifdef LGPE_PUSH_BUSH
float pushBend = uPushBushBend;
#else
float pushBend = uPushBend;
#endif
transformed += vegPush(swayRest.y, uSwayHeight, aWind.xy, aWind.zw,
  vegHash(aWind.xy), pushBend);
#endif
#endif
#ifdef LGPE_SWAY_TREE
float swayRise = clamp(transformed.y / uSwayHeight, 0.0, 1.0);
transformed += vegCanopySway(transformed, 0.0, uSwayHeight, aWind.xy,
  aWind.zw, vegHash(aWind.xy), 1.0) * swayRise * swayRise;
#endif
`

const RAMP_VERTEX = /* glsl */ `
#include <uv_vertex>
#ifdef LGPE_RAMP
vRampUv = uv1;
#endif
`

const RAMP_FRAGMENT = /* glsl */ `
#include <map_fragment>
#ifdef LGPE_RAMP
vec3 rampColor = texture2D(uRampMap, vRampUv).rgb;
vec3 shadeColor = mix(vec3(1.0), texture2D(uShadeMap, vMapUv).rgb, uShadeAmount);
diffuseColor.rgb = rampColor * shadeColor + sampledDiffuseColor.rgb;
#endif
`

const RIM = /* glsl */ `
float rimFactor = 1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0);
outgoingLight += uRimColor * uRimStrength * uSunGlow * smoothstep(uRimMin, uRimMax, rimFactor);
#include <opaque_fragment>
`

/**
 * @param {object} options
 * @param {THREE.Texture | null} options.map
 * @param {number | null} options.cutoff - corte do alfa (recortados)
 * @param {boolean} options.doubleSided
 * @param {boolean} options.vertexColors
 * @param {number[] | null} options.rimColor
 * @param {number[] | null} options.rim - `[min, max, força]` do jogo
 * @param {'plant' | 'tree' | null} [options.sway] - como o vento mexe
 *   (`null`: parado, ex.: pedra)
 * @param {false | 'grass' | 'bush'} [options.push] - abre para quem
 *   passa (só com `sway: 'plant'`): com a dobra da grama ou a dos
 *   arbustos (`GRASS_PUSH.BUSH`)
 * @param {number} options.height - altura do modelo (m), para o vento
 * @param {THREE.Texture | null} [options.rampMap]
 * @param {THREE.Texture | null} [options.shadeMap]
 */
export function createToonMaterial({
  map,
  cutoff,
  doubleSided,
  vertexColors,
  rimColor,
  rim,
  sway = null,
  push = false,
  height = 1,
  rampMap = null,
  shadeMap = null,
}) {
  const own = {
    uRimColor: { value: new THREE.Color().fromArray(rimColor ?? [0, 0, 0]) },
    uRimMin: { value: rim?.[0] ?? 0.5 },
    uRimMax: { value: rim?.[1] ?? 1 },
    uSwayHeight: { value: Math.max(height, 0.1) },
    uRampMap: { value: rampMap },
    uShadeMap: { value: shadeMap ?? rampMap },
    uShadeAmount: { value: shadeMap ? 1 : 0 },
  }
  if (rim) own.uRimColor.value.multiplyScalar(rim[2])
  const material = new THREE.MeshToonMaterial({
    map,
    gradientMap: toonRamp,
    side: doubleSided ? THREE.DoubleSide : THREE.FrontSide,
    vertexColors,
  })
  material.userData.toon = { baseCutoff: cutoff }
  applyToonCutoff(material)
  if (rampMap) material.defines = { ...material.defines, LGPE_RAMP: '' }
  if (sway) {
    const define = sway === 'tree' ? 'LGPE_SWAY_TREE' : 'LGPE_SWAY_PLANT'
    material.defines = { ...material.defines, [define]: '' }
  }
  if (push && sway === 'plant') {
    material.defines = { ...material.defines, LGPE_PUSH: '' }
    if (push === 'bush') {
      material.defines = { ...material.defines, LGPE_PUSH_BUSH: '' }
    }
  }
  material.onBeforeCompile = (shader) => {
    Object.assign(
      shader.uniforms,
      vegetationUniforms,
      toonUniforms,
      grassPushUniforms,
      own,
    )
    shader.vertexShader =
      VERTEX_HEADER +
      shader.vertexShader
        .replace('#include <color_vertex>', COLOR_VERTEX)
        .replace('#include <begin_vertex>', SWAY)
        .replace('#include <uv_vertex>', RAMP_VERTEX)
    shader.fragmentShader =
      FRAGMENT_HEADER +
      shader.fragmentShader
        .replace('#include <gradientmap_pars_fragment>', GRADIENT)
        .replace('#include <map_fragment>', RAMP_FRAGMENT)
        .replace('#include <opaque_fragment>', RIM)
  }
  material.customProgramCacheKey = () =>
    `lgpe-toon-${vertexColors}-${Boolean(rampMap)}-${sway}-${push}`
  return withSeeThrough(material)
}

/** Corte do alfa dos recortados: o do jogo original vezes `LGPE.CUTOFF`. */
function applyToonCutoff(material) {
  const { baseCutoff } = material.userData.toon
  if (!baseCutoff) return
  // O jogo original corta mais alto que o three costuma; limitado para a
  // folha não sumir de longe (mipmap).
  const next = Math.min(
    0.95,
    Math.min(baseCutoff, 0.9) * 0.6 * GAME_CONFIG.LGPE.CUTOFF,
  )
  if (Math.abs(material.alphaTest - next) > 1e-4) material.alphaTest = next
}

/**
 * Os números do `GAME_CONFIG.LGPE` em todos os materiais toon (uma vez por
 * quadro — o debug mexe ao vivo) e o corte de cada um (`materials`).
 */
export function applyToonLook(materials = []) {
  const { LGPE } = GAME_CONFIG
  toonUniforms.uShadowTint.value.set(LGPE.SHADOW_TINT)
  toonUniforms.uRimStrength.value = LGPE.RIM_STRENGTH
  toonUniforms.uVertexColor.value = LGPE.VERTEX_COLOR
  setToonRamp(LGPE.RAMP_THRESHOLD, LGPE.RAMP_SOFTNESS)
  for (const material of materials) applyToonCutoff(material)
}
