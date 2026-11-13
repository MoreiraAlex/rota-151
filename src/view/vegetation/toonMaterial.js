import * as THREE from 'three'
import { GAME_CONFIG } from '@/core/gameConfig'
import { withSeeThrough } from '@/view/materials/seeThrough'
import { GRASS_PUSH_SHADER, grassPushUniforms } from './grassPush'
import { WIND_SHADER, vegetationUniforms } from './windShader'
import { markAsPlant, markAsScenery } from '@/view/materials/characterStencil'

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
 * - a **tinta do bioma** (`aRecolor` por instância, view/vegetation/
 *   biomeColor.js): no fim, puxa o tom para uma cor mantendo o claro e
 *   escuro (o verde do LGPE vira o amarelado da savana — a sombra e a
 *   borda junto);
 * - o **vento** da vegetação (`windShader.js`, o mesmo de todo o resto):
 *   as plantas dobram em arco (`vegGrassSway`) e as árvores balançam
 *   como copas (`vegCanopySway`, com o pé parado) — sem
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
 *   o alvo, some em pontilhado;
 * - nas plantas, a **base mais escura** (`LGPE.BASE_SHADE`,
 *   docs/features/066-revisao-dos-biomas.md): o pé escurece e clareia
 *   subindo, pela altura de repouso do modelo;
 * - a **sombra recebida numa leitura só** (`SHADOW_SINGLE_TAP`,
 *   view/scene/shadowFilter.js, 066);
 * - **some perto da câmera** (`nearHide`, `CAMERA.NEAR_HIDE`, 066): as
 *   folhas das árvores e as pedras e os prédios inteiros — com a câmera
 *   dentro da caixa de uma instância (ou quase), todos os vértices dela
 *   vão para fora da tela já no vertex shader (nenhum pixel), e na faixa
 *   de transição ela some em pontilhado. A sombra fica.
 *
 * Os números do `GAME_CONFIG.LGPE` valem para todos de uma vez
 * (`toonUniforms`, os mesmos objetos em todos — `applyToonLook` a cada
 * quadro).
 */

export const toonUniforms = {
  uShadowTint: { value: new THREE.Color() },
  uRimStrength: { value: 0 },
  uVertexColor: { value: 1 },
  uBaseShade: { value: 0 },
  uBaseShadeHeight: { value: 1 },
  uBladeFade: { value: new THREE.Vector2(0, 1) },
  uBladeFarShade: { value: 1 },
  // A luz dos postes (`glow`): quanto é noite (0 a 1, `setNightGlow`) e a
  // cor dela (`LGPE.LAMP_GLOW`).
  uNightGlow: { value: 0 },
  uGlowColor: { value: new THREE.Color() },
}

/**
 * Quanto é noite (0 a 1) para o que acende (`glow`: o vidro dos postes) —
 * a view do dia e da noite, a cada quadro.
 */
export function setNightGlow(amount) {
  toonUniforms.uNightGlow.value = Math.min(1, Math.max(0, amount))
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

// A faixa do peso (canal vermelho) em que a camada de cima do chão
// misturado entra: abaixo, só a de baixo; acima, só a de cima.
const LAYER_BLEND = [0.3, 0.7]

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
#ifdef LGPE_LAYER
// O chão misturado do mapa (a camada de cima pelo canal vermelho da cor do
// vértice — peso, não cor), mesmo sem a cor por vértice ligada.
#if !defined(USE_COLOR) && !defined(USE_COLOR_ALPHA)
attribute vec3 color;
#endif
varying float vLayerWeight;
#ifdef LGPE_LAYER_UV1
#ifndef LGPE_RAMP
attribute vec2 uv1;
#endif
varying vec2 vLayerUv;
#endif
#endif
#if defined(LGPE_PUSH) && defined(USE_INSTANCING)
${GRASS_PUSH_SHADER}
#endif
#if defined(LGPE_BILLBOARD) && defined(LGPE_SWAY_PLANT) && defined(USE_INSTANCING)
// Gira a planta parada para o plano dela (o +z do modelo) ficar de frente
// para a câmera, descontando o giro da instância (facing). O vento e o
// empurrão somam depois, no espaço local da instância: não mudam.
vec3 vegFaceCamera(vec3 p, vec2 origin, vec2 facing) {
  vec2 toCamera = cameraPosition.xz - origin;
  if (dot(toCamera, toCamera) < 1e-6) return p;
  float turn = atan(toCamera.x, toCamera.y) - atan(facing.y, facing.x);
  float c = cos(turn);
  float s = sin(turn);
  return vec3(p.x * c + p.z * s, p.y, p.z * c - p.x * s);
}
#endif
#ifdef USE_INSTANCING
// Por instância: a cor da tinta (rgb) e quanto puxa para ela (a).
attribute vec4 aRecolor;
#endif
varying vec4 vRecolor;
#ifdef LGPE_SWAY_PLANT
varying float vBaseRise;
#endif
#ifdef LGPE_BLADE_FADE
uniform vec2 uBladeFade;
uniform float uBladeFarShade;
varying float vBladeFar;
#endif
#ifdef LGPE_NEAR_HIDE
// Caixa do que some no espaço do modelo; x = distância (m) dela em que
// some de vez, y = largura (m) da faixa em pontilhado. vNearKeep: quanto
// fica (1 inteiro, 0 some) — igual em todos os vértices de uma instância.
uniform vec3 uNearBoxMin;
uniform vec3 uNearBoxMax;
uniform vec2 uNearHide;
varying float vNearKeep;
#ifdef USE_INSTANCING
// Distância (m) da câmera até a caixa desta instância — negativa dentro
// dela. A instância é giro + escala por eixo + posição (instancing.js,
// setInstance); a malha fica na origem (finishMesh).
float lgpeNearKeep() {
  vec3 axisX = instanceMatrix[0].xyz;
  vec3 axisY = instanceMatrix[1].xyz;
  vec3 axisZ = instanceMatrix[2].xyz;
  vec3 scale2 = max(vec3(dot(axisX, axisX), dot(axisY, axisY), dot(axisZ, axisZ)), vec3(1e-6));
  vec3 toCamera = cameraPosition - (modelMatrix * vec4(instanceMatrix[3].xyz, 1.0)).xyz;
  vec3 local = vec3(dot(axisX, toCamera), dot(axisY, toCamera), dot(axisZ, toCamera)) / scale2;
  vec3 gap = max(uNearBoxMin - local, local - uNearBoxMax) * sqrt(scale2);
  float distance = length(max(gap, 0.0)) + min(max(gap.x, max(gap.y, gap.z)), 0.0);
  return smoothstep(uNearHide.x, uNearHide.x + max(uNearHide.y, 1e-3), distance);
}
#endif
#endif
`

// Some perto da câmera (ver o cabeçalho): sem nenhum pixel, todos os
// vértices no mesmo ponto fora da tela.
const NEAR_HIDE_VERTEX = /* glsl */ `
#include <project_vertex>
#ifdef LGPE_NEAR_HIDE
#ifdef USE_INSTANCING
vNearKeep = lgpeNearKeep();
if (vNearKeep <= 0.0) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
#else
vNearKeep = 1.0;
#endif
#endif
`

// Na faixa de transição, some em pontilhado (logo no começo, antes da
// luz).
const NEAR_HIDE_FRAGMENT = /* glsl */ `
#include <clipping_planes_fragment>
#ifdef LGPE_NEAR_HIDE
if (vNearKeep < 1.0 && vNearKeep <= fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))))) discard;
#endif
`

const FRAGMENT_HEADER = /* glsl */ `
varying vec4 vRecolor;
#ifdef LGPE_NEAR_HIDE
varying float vNearKeep;
#endif
#ifdef LGPE_SWAY_PLANT
varying float vBaseRise;
uniform float uBaseShade;
uniform float uBaseShadeHeight;
#endif
#ifdef LGPE_BLADE_FADE
varying float vBladeFar;
#endif
#ifdef LGPE_GLOW
uniform float uNightGlow;
uniform vec3 uGlowColor;
#endif
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
#ifdef LGPE_LAYER
uniform sampler2D uLayerMap;
uniform vec2 uLayerBlend;
varying float vLayerWeight;
#ifdef LGPE_LAYER_UV1
varying vec2 vLayerUv;
#endif
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
#if defined(LGPE_BLADE_FADE) && defined(USE_INSTANCING)
// A grama em fios encolhe com a distância (bladeGrass.js) e, nessa faixa,
// o tom da lâmina vira o do chão debaixo dela (uBladeFarShade).
float bladeFar = smoothstep(uBladeFade.x, uBladeFade.y,
  distance(cameraPosition.xz, aWind.xy));
vBladeFar = bladeFar;
#elif defined(LGPE_BLADE_FADE)
vBladeFar = 0.0;
#endif
#if defined(USE_COLOR) || defined(USE_INSTANCING_COLOR)
vColor = vec4(1.0);
#endif
#ifdef USE_COLOR
vec3 vertexShade = mix(vec3(1.0), color.rgb, uVertexColor);
#if defined(LGPE_BLADE_FADE) && defined(USE_INSTANCING)
vertexShade = mix(vertexShade, vec3(uBladeFarShade), bladeFar);
#endif
vColor.rgb *= vertexShade;
#endif
#ifdef USE_INSTANCING_COLOR
vColor.rgb *= instanceColor.rgb;
#endif
#ifdef USE_INSTANCING
vRecolor = aRecolor;
#else
vRecolor = vec4(0.0);
#endif
`

// Planta: a dobra em arco do vento. Árvore: o balanço das copas,
// crescendo do pé (parado) ao topo.
const SWAY = /* glsl */ `
#include <begin_vertex>
#ifdef LGPE_SWAY_PLANT
#if defined(LGPE_BILLBOARD) && defined(USE_INSTANCING)
transformed = vegFaceCamera(transformed, aWind.xy, aWind.zw);
#endif
#if defined(LGPE_BLADE_FADE) && defined(USE_INSTANCING)
transformed *= 1.0 - bladeFar;
#endif
float plantRestY = transformed.y;
vec3 swayRest = transformed;
vBaseRise = clamp(plantRestY / uSwayHeight, 0.0, 1.0);
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
#ifdef LGPE_LAYER
vLayerWeight = color.r;
#ifdef LGPE_LAYER_UV1
vLayerUv = uv1;
#endif
#endif
`

const RAMP_FRAGMENT = /* glsl */ `
#include <map_fragment>
#ifdef LGPE_RAMP
vec3 rampColor = texture2D(uRampMap, vRampUv).rgb;
vec3 shadeColor = mix(vec3(1.0), texture2D(uShadeMap, vMapUv).rgb, uShadeAmount);
diffuseColor.rgb = rampColor * shadeColor + sampledDiffuseColor.rgb;
#endif
#ifdef LGPE_LAYER
// A camada de baixo (grama) é o mapa; a de cima (terra, barranco, pedra)
// aparece pelo peso, com a borda apertada na faixa de uLayerBlend.
#ifdef LGPE_LAYER_UV1
vec3 layerColor = texture2D(uLayerMap, vLayerUv).rgb;
#else
vec3 layerColor = texture2D(uLayerMap, vMapUv).rgb;
#endif
float layerAmount = smoothstep(uLayerBlend.x, uLayerBlend.y, vLayerWeight);
diffuseColor.rgb = mix(diffuseColor.rgb, layerColor, layerAmount);
#endif
`

// Luz de borda e, por último, a tinta: o tom vira o da cor (normalizada
// pelo brilho dela), com o brilho de cada ponto já iluminado — o desenho,
// a sombra e a borda ficam, a cor muda (sem sobrar o verde da borda e da
// sombra do jogo original).
const RIM = /* glsl */ `
#ifdef LGPE_SWAY_PLANT
float baseShade = uBaseShade;
#ifdef LGPE_BLADE_FADE
// Sumindo, a base escura também vira o tom chapado do chão.
baseShade *= 1.0 - vBladeFar;
#endif
outgoingLight *= 1.0 - baseShade * (1.0 - smoothstep(0.0, max(uBaseShadeHeight, 1e-3), vBaseRise));
#endif
float rimFactor = 1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0);
outgoingLight += uRimColor * uRimStrength * uSunGlow * smoothstep(uRimMin, uRimMax, rimFactor);
if (vRecolor.a > 0.0) {
  const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);
  vec3 hue = vRecolor.rgb / max(dot(vRecolor.rgb, LUMA), 1e-3);
  vec3 recolored = hue * dot(outgoingLight, LUMA);
  outgoingLight = mix(outgoingLight, recolored, vRecolor.a);
}
#ifdef LGPE_GLOW
// Aceso à noite (o vidro do poste): a cor dele vezes a da luz, sem a luz
// da cena.
outgoingLight = mix(outgoingLight, diffuseColor.rgb * uGlowColor, uNightGlow);
#endif
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
 * @param {boolean} [options.billboard] - sempre de frente para a câmera
 *   (só com `sway: 'plant'`): os tufos, que são planos
 * @param {boolean} [options.fade] - encolhe com a distância
 *   (`GRASS_BLADES.FADE_*`, só com `sway: 'plant'`): a grama em fios
 * @param {number} options.height - altura do modelo (m), para o vento
 * @param {THREE.Texture | null} [options.rampMap]
 * @param {THREE.Texture | null} [options.shadeMap]
 * @param {{ box: THREE.Box3, kind: 'CANOPY' | 'SOLID' } | null} [options.nearHide]
 * @param {THREE.Texture | null} [options.layerMap] - a camada de cima do
 *   chão misturado (terra, barranco, pedra): aparece pelo canal vermelho da
 *   cor do vértice (docs/features/069-revisao-do-bioma-cidade.md, Pallet)
 * @param {0 | 1} [options.layerUv] - o UV em que ela é lida
 *   - some com a câmera dentro de `box` (espaço do modelo), com a
 *   distância de `CAMERA.NEAR_HIDE[kind]`: as folhas das árvores, as
 *   pedras e os prédios
 * @param {boolean} [options.glow] - acende à noite (`setNightGlow`,
 *   `LGPE.LAMP_GLOW`): o vidro dos postes
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
  billboard = false,
  fade = false,
  height = 1,
  rampMap = null,
  shadeMap = null,
  nearHide = null,
  layerMap = null,
  layerUv = 0,
  glow = false,
}) {
  const own = {
    uRimColor: { value: new THREE.Color().fromArray(rimColor ?? [0, 0, 0]) },
    uRimMin: { value: rim?.[0] ?? 0.5 },
    uRimMax: { value: rim?.[1] ?? 1 },
    uSwayHeight: { value: Math.max(height, 0.1) },
    uRampMap: { value: rampMap },
    uShadeMap: { value: shadeMap ?? rampMap },
    uShadeAmount: { value: shadeMap ? 1 : 0 },
    uNearBoxMin: { value: nearHide?.box.min.clone() ?? new THREE.Vector3() },
    uNearBoxMax: { value: nearHide?.box.max.clone() ?? new THREE.Vector3() },
    uNearHide: { value: new THREE.Vector2() },
    uLayerMap: { value: layerMap },
    uLayerBlend: { value: new THREE.Vector2(...LAYER_BLEND) },
  }
  if (rim) own.uRimColor.value.multiplyScalar(rim[2])
  const material = new THREE.MeshToonMaterial({
    map,
    gradientMap: toonRamp,
    side: doubleSided ? THREE.DoubleSide : THREE.FrontSide,
    vertexColors,
  })
  material.userData.toon = { baseCutoff: cutoff, own, nearKind: nearHide?.kind }
  // A sombra numa leitura só (view/scene/shadowFilter.js): nas folhas
  // empilhadas a borda macia não aparece e custa várias vezes o chão.
  material.defines = { ...material.defines, SHADOW_SINGLE_TAP: '' }
  applyToonCutoff(material)
  if (rampMap) material.defines = { ...material.defines, LGPE_RAMP: '' }
  if (layerMap) {
    material.defines = { ...material.defines, LGPE_LAYER: '' }
    if (layerUv === 1) {
      material.defines = { ...material.defines, LGPE_LAYER_UV1: '' }
    }
  }
  if (glow) material.defines = { ...material.defines, LGPE_GLOW: '' }
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
  if (billboard && sway === 'plant') {
    material.defines = { ...material.defines, LGPE_BILLBOARD: '' }
  }
  if (fade && sway === 'plant') {
    material.defines = { ...material.defines, LGPE_BLADE_FADE: '' }
  }
  if (nearHide) {
    applyNearHide(material)
    material.defines = { ...material.defines, LGPE_NEAR_HIDE: '' }
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
        .replace('#include <project_vertex>', NEAR_HIDE_VERTEX)
    shader.fragmentShader =
      FRAGMENT_HEADER +
      shader.fragmentShader
        .replace('#include <clipping_planes_fragment>', NEAR_HIDE_FRAGMENT)
        .replace('#include <gradientmap_pars_fragment>', GRADIENT)
        .replace('#include <map_fragment>', RAMP_FRAGMENT)
        .replace('#include <opaque_fragment>', RIM)
  }
  material.customProgramCacheKey = () =>
    `lgpe-toon-${vertexColors}-${Boolean(rampMap)}-${sway}-${push}-${billboard}-${fade}-${Boolean(nearHide)}-${layerMap ? layerUv : 'no-layer'}-${glow}`
  // No stencil: planta (a silhueta de quem está atrás dela aparece) ou o
  // resto do cenário (materials/characterStencil.js).
  if (sway === 'plant') markAsPlant(material)
  else markAsScenery(material)
  return withSeeThrough(material)
}

/**
 * A distância e a faixa de sumir perto da câmera do material (as do tipo
 * dele em `CAMERA.NEAR_HIDE`). Desligado, nunca some: a distância fica
 * fora de alcance.
 */
function applyNearHide(material) {
  const { own, nearKind } = material.userData.toon
  if (!nearKind) return
  const { ENABLED, [nearKind]: settings } = GAME_CONFIG.CAMERA.NEAR_HIDE
  own.uNearHide.value.set(ENABLED ? settings.HIDE : -1e6, settings.FADE)
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
  toonUniforms.uBaseShade.value = LGPE.BASE_SHADE
  toonUniforms.uBaseShadeHeight.value = LGPE.BASE_SHADE_HEIGHT
  toonUniforms.uGlowColor.value
    .set(LGPE.LAMP_GLOW.COLOR)
    .multiplyScalar(LGPE.LAMP_GLOW.STRENGTH)
  const { FADE_START, FADE_END, GROUND_SHADE } = GAME_CONFIG.GRASS_BLADES
  toonUniforms.uBladeFarShade.value = GROUND_SHADE ?? 1
  toonUniforms.uBladeFade.value.set(
    FADE_START,
    Math.max(FADE_END, FADE_START + 0.1),
  )
  setToonRamp(LGPE.RAMP_THRESHOLD, LGPE.RAMP_SOFTNESS)
  for (const material of materials) {
    applyToonCutoff(material)
    applyNearHide(material)
    // A cor base da grama em fios (bladeGrass.js), ao vivo.
    if (material.userData.bladeGrass) {
      material.color.set(GAME_CONFIG.GRASS_BLADES.COLOR)
    }
  }
}
