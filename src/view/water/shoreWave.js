import { GAME_CONFIG } from '@/core/gameConfig'

/**
 * Ondas na margem (docs/features/057-lagos-e-rios.md): perto da beira, a
 * superfície da água sobe e desce — sobe rápido (a onda chegando, cobrindo a
 * encosta) e desce devagar (recuando, descobrindo o fundo molhado). Cada
 * trecho da margem tem a própria fase (um ruído pela posição), e a onda
 * chega um pouco antes no mais fundo, como vindo de fora. Longe da beira
 * (`SHORE_WAVE.DEPTH` m de profundidade) a superfície fica parada.
 *
 * Usado pelo material da água (`waterMaterial.js`): `SHORE_WAVE_VERTEX`
 * move o vértice e entrega
 * `vSwash` (m) ao fragmento, que soma na profundidade — a espuma e a
 * transparência seguem a beira que anda. A malha cobre também a terra até
 * `SHORE_REACH` m acima da água (`buildWaterChunkGeometry`), para a onda ter
 * onde subir.
 */

// Até quantos metros acima da água a malha cobre a terra da beira — o teto
// da altura da onda no F2.
export const SHORE_REACH = 1

export const SHORE_WAVE_VERTEX_HEADER = /* glsl */ `
uniform float uShoreHeight;
uniform float uShoreSpeed;
uniform float uShoreSize;
uniform float uShoreDepth;
uniform float uShoreTime;
varying float vSwash;

float shoreHash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float shoreNoise(vec2 p) {
  vec2 cell = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(shoreHash(cell), shoreHash(cell + vec2(1.0, 0.0)), u.x),
    mix(shoreHash(cell + vec2(0.0, 1.0)), shoreHash(cell + vec2(1.0, 1.0)), u.x),
    u.y);
}

// Quanto (m) a superfície sobe (+) ou desce (-) agora em \`point\`, a
// \`depth\` m de profundidade.
float shoreSwash(vec2 point, float depth) {
  float phase = shoreNoise(point / uShoreSize) * 2.0 + depth * 0.6;
  float w = fract(uShoreTime * uShoreSpeed + phase);
  // Sobe no primeiro quarto do ciclo, recua no resto.
  float shape = w < 0.25
    ? smoothstep(0.0, 0.25, w)
    : 1.0 - smoothstep(0.25, 1.0, w);
  float nearShore = 1.0 - smoothstep(uShoreDepth * 0.5, uShoreDepth, depth);
  return uShoreHeight * (shape - 0.4) * nearShore;
}
`

// Depois de `vWaterWorld` e `vWaterDepth` (o vértice parado).
export const SHORE_WAVE_VERTEX = /* glsl */ `
vSwash = shoreSwash(vWaterWorld.xz, vWaterDepth);
transformed.y += vSwash;
vWaterWorld.y += vSwash;
`

export const SHORE_WAVE_FRAGMENT_HEADER = /* glsl */ `
varying float vSwash;
`

/** Os uniforms das ondas da margem (somar aos do material). */
export function createShoreWaveUniforms() {
  return {
    uShoreHeight: { value: 0 },
    uShoreSpeed: { value: 0 },
    uShoreSize: { value: 1 },
    uShoreDepth: { value: 1 },
    uShoreTime: { value: 0 },
  }
}

/** Passa `GAME_CONFIG.WATER.SHORE_WAVE` aos uniforms. */
export function applyShoreWave(uniforms, water = GAME_CONFIG.WATER) {
  const { HEIGHT, SPEED, SIZE, DEPTH } = water.SHORE_WAVE
  uniforms.uShoreHeight.value = Math.min(HEIGHT, SHORE_REACH)
  uniforms.uShoreSpeed.value = SPEED
  uniforms.uShoreSize.value = SIZE
  uniforms.uShoreDepth.value = DEPTH
}
