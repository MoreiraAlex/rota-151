import * as THREE from 'three'
import { GAME_CONFIG } from '@/core/gameConfig'

const VERTEX_HEADER = /* glsl */ `
attribute float waterDepth;
varying float vWaterDepth;
varying vec3 vWaterWorld;
`

const VERTEX_WORLD = /* glsl */ `
#include <begin_vertex>
vWaterDepth = waterDepth;
vWaterWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;
`

const FRAGMENT_HEADER = /* glsl */ `
uniform vec3 uShallowColor;
uniform vec3 uDeepColor;
uniform float uDeepDepth;
uniform float uShoreOpacity;
uniform float uDeepOpacity;
uniform float uOpacityDepth;
uniform vec3 uFoamColor;
uniform float uFoamWidth;
uniform float uWaveSize;
uniform float uWaveSpeed;
uniform float uWaveStrength;
uniform float uReflection;
uniform float uTime;
uniform vec3 uSkyColor;
varying float vWaterDepth;
varying vec3 vWaterWorld;

float waterHash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float waterNoise(vec2 p) {
  vec2 cell = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(waterHash(cell), waterHash(cell + vec2(1.0, 0.0)), u.x),
    mix(waterHash(cell + vec2(0.0, 1.0)), waterHash(cell + vec2(1.0, 1.0)), u.x),
    u.y);
}

// Altura das ondinhas: duas camadas andando em direções diferentes.
float waterWaves(vec2 p) {
  float t = uTime * uWaveSpeed;
  return waterNoise(p + vec2(t, t * 0.6))
    + waterNoise(p * 1.9 - vec2(t * 0.7, -t)) * 0.5;
}
`

// Cor pela profundidade (margem clara, fundo escuro), espuma na beira e a
// transparência (na margem dá para ver o chão).
const FRAGMENT_COLOR = /* glsl */ `
#include <color_fragment>
if (vWaterDepth <= 0.0) discard;
vec2 wavePoint = vWaterWorld.xz / uWaveSize;
float waveHeight = waterWaves(wavePoint);
vec3 waterColor = mix(uShallowColor, uDeepColor, smoothstep(0.0, uDeepDepth, vWaterDepth));
float foam = 1.0 - smoothstep(0.0, uFoamWidth,
  vWaterDepth + (waveHeight - 0.75) * uFoamWidth);
diffuseColor.rgb = mix(waterColor, uFoamColor, foam * 0.85);
diffuseColor.a = max(
  mix(uShoreOpacity, uDeepOpacity, smoothstep(0.0, uOpacityDepth, vWaterDepth)),
  foam * 0.9);
`

// Normal das ondinhas (pela diferença da altura ao lado).
const FRAGMENT_NORMAL = /* glsl */ `
#include <normal_fragment_maps>
float waveStep = 0.08;
float waveX = waterWaves(wavePoint + vec2(waveStep, 0.0));
float waveZ = waterWaves(wavePoint + vec2(0.0, waveStep));
vec3 waveNormal = normalize(vec3(
  (waveHeight - waveX) / waveStep * uWaveStrength,
  1.0,
  (waveHeight - waveZ) / waveStep * uWaveStrength));
normal = normalize((viewMatrix * vec4(waveNormal, 0.0)).xyz);
`

// O céu refletido: um pouco olhando de cima (com luz baixa, a água não
// some no chão) e mais vendo a água de lado.
const FRAGMENT_EMISSIVE = /* glsl */ `
#include <emissivemap_fragment>
float waterFresnel = pow(1.0 - max(dot(normal, normalize(vViewPosition)), 0.0), 4.0);
totalEmissiveRadiance += uSkyColor * (0.3 + 0.7 * waterFresnel) * uReflection
  * (1.0 - foam);
`

/**
 * Material da água (docs/features/049-vegetacao-e-floresta.md) — uma
 * representação simples até a água de verdade (056): `MeshStandardMaterial`
 * transparente (recebe sol, sombra e névoa do jogo) com a cor pela
 * profundidade (`waterDepth` da geometria), espuma na beira, ondinhas que
 * pegam o brilho do sol e o céu refletido. Os números são de
 * `GAME_CONFIG.WATER` (`applyWaterLook`); a hora e a cor do céu,
 * `updateWater`. Um material para todos os chunks; quem cria chama
 * `dispose()`.
 */
export function createWaterMaterial() {
  const uniforms = {
    uShallowColor: { value: new THREE.Color() },
    uDeepColor: { value: new THREE.Color() },
    uDeepDepth: { value: 1 },
    uShoreOpacity: { value: 1 },
    uDeepOpacity: { value: 1 },
    uOpacityDepth: { value: 1 },
    uFoamColor: { value: new THREE.Color() },
    uFoamWidth: { value: 0.1 },
    uWaveSize: { value: 1 },
    uWaveSpeed: { value: 0 },
    uWaveStrength: { value: 0 },
    uReflection: { value: 0 },
    uTime: { value: 0 },
    uSkyColor: { value: new THREE.Color() },
  }
  const material = new THREE.MeshStandardMaterial({
    transparent: true,
    depthWrite: false,
    metalness: 0,
  })
  material.userData.waterUniforms = uniforms
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms)
    shader.vertexShader = (VERTEX_HEADER + shader.vertexShader).replace(
      '#include <begin_vertex>',
      VERTEX_WORLD,
    )
    shader.fragmentShader = (FRAGMENT_HEADER + shader.fragmentShader)
      .replace('#include <color_fragment>', FRAGMENT_COLOR)
      .replace('#include <normal_fragment_maps>', FRAGMENT_NORMAL)
      .replace('#include <emissivemap_fragment>', FRAGMENT_EMISSIVE)
  }
  material.customProgramCacheKey = () => 'water-surface'
  applyWaterLook(material)
  return material
}

/** Passa os números de `GAME_CONFIG.WATER` para o material. */
export function applyWaterLook(material, water = GAME_CONFIG.WATER) {
  const uniforms = material.userData.waterUniforms
  uniforms.uShallowColor.value.set(water.SHALLOW_COLOR)
  uniforms.uDeepColor.value.set(water.DEEP_COLOR)
  uniforms.uDeepDepth.value = water.DEEP_DEPTH
  uniforms.uShoreOpacity.value = water.SHORE_OPACITY
  uniforms.uDeepOpacity.value = water.DEEP_OPACITY
  uniforms.uOpacityDepth.value = water.OPACITY_DEPTH
  uniforms.uFoamColor.value.set(water.FOAM_COLOR)
  uniforms.uFoamWidth.value = water.FOAM_WIDTH
  uniforms.uWaveSize.value = water.WAVE_SIZE
  uniforms.uWaveSpeed.value = water.WAVE_SPEED
  uniforms.uWaveStrength.value = water.WAVE_STRENGTH
  uniforms.uReflection.value = water.REFLECTION
  material.roughness = water.ROUGHNESS
}

/** O tempo das ondinhas e a cor do céu refletido (linear). */
export function updateWater(material, delta, skyColor) {
  const uniforms = material.userData.waterUniforms
  uniforms.uTime.value += delta
  if (skyColor) uniforms.uSkyColor.value.copy(skyColor)
}
