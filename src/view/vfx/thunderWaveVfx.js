import { compileGradient } from './particleSimulation'
import { GLARE_TEXTURE_PATHS } from './glareVfx'

/**
 * Onda de Trovão (Thunder Wave) em partículas — tradução manual das
 * definições do Cobblemon (`.exemple/Coblemon/assets/cobblemon/bedrock/
 * particles/moves/thunderwave/` e a linha do tempo em `data/cobblemon/
 * action_effects/moves/thunderwave.json`). Mesmo contrato de `ctx`/`rnd` de
 * `emberVfx.js`; nasce no `effectAt`, no contato com o alvo (errou: no fim da
 * trajetória):
 *
 *   - `launch-1`/`launch-2` — os anéis grandes saindo de quem usa
 *     (`thunderwave_launch1`/`2`)
 *   - `wave`     — os anéis correndo de quem usa até o alvo
 *     (`thunderwave_actor`), em `WAVE_TRAVEL`
 *   - quando a onda chega: `ring` — o anel enorme no alvo
 *     (`thunderwave_impact1`); `orbit-1`/`orbit-2` — anéis girando em volta
 *     do ponto (`_impact2`/`_impact3`); `sparks` — as faíscas da paralisia
 *     (`thunderwave_sparking`, a textura do status)
 *
 * Os anéis ficam DE PÉ, de frente pro golpe (o `emitter_transform_xy` do
 * Bedrock): quadro `plane` com a face pra +Z e o eixo fixo (`axis`), andando
 * na direção pra onde estão virados. A linha do tempo do original foi
 * encurtada. Espaço local: impacto em (0, 0, 0), criatura em
 * (0, 0, -length), +Z na direção do golpe — o eixo Z do Bedrock aponta pro
 * lado oposto, então todo `z` foi INVERTIDO na tradução.
 */

export const THUNDER_WAVE_TEXTURE_PATHS = {
  medium: '/assets/effects/thunder-wave/mediumring.png',
  large: '/assets/effects/thunder-wave/largering.png',
  xl: '/assets/effects/thunder-wave/xlring.png',
  tiny: GLARE_TEXTURE_PATHS.tiny,
}

// Quanto a onda leva pra chegar no alvo (s).
export const WAVE_TRAVEL = 0.35
// Quanto dura a saída dos anéis grandes de quem usa (s).
const LAUNCH_WINDOW = 0.3

// Do branco-amarelado ao amarelo elétrico (os gradientes ARGB, opacos).
const RING_TINT = compileGradient([
  { at: 0, color: '#fffbe3' },
  { at: 0.47, color: '#ffe24f' },
  { at: 1, color: '#ffe24f' },
])
const WHITE = compileGradient([{ at: 0, color: '#ffffff' }])

// `math.random(a, b)` com uma random da partícula.
const between = (r, a, b) => a + r * (b - a)

// O anel de pé, de frente pro golpe.
const standing = {
  facing: 'plane',
  normal: [0, 0, 1],
  axis: [1, 0, 0],
  blending: 'normal',
  accel: () => [0, 0, 0],
  spin: false,
  tint: RING_TINT,
}

const launch = (id, texture, strip, size, speed, drag) => ({
  ...standing,
  id,
  texture,
  strip,
  frames: { first: 0, count: strip, fps: 20 },
  start: 0,
  duration: LAUNCH_WINDOW,
  rate: () => 10,
  anchor: 'origin',
  offset: () => [0, 0, 0.1],
  direction: () => [0, 0, 1],
  speed: () => speed,
  drag: () => drag,
  lifetime: () => 0.45,
  size: () => size,
})

// Os anéis girando em volta do ponto, no plano de frente pro golpe (o
// `math.sin`/`math.cos` do Bedrock é em graus; aqui, em voltas por segundo).
const orbit = (id, texture, strip, fps, size, radius, phase, z) => ({
  ...standing,
  id,
  texture,
  strip,
  frames: { first: 0, count: strip, fps },
  start: WAVE_TRAVEL,
  duration: 0.25,
  rate: () => 24,
  anchor: 'impact',
  offset: (ctx) => {
    const angle = ctx.age * Math.PI * 2 * 7.5 + phase
    return [Math.sin(angle) * radius, -Math.cos(angle) * radius, z]
  },
  direction: () => [0, 0, 1],
  speed: () => 0,
  drag: () => 0,
  lifetime: () => 0.405,
  size: () => size,
})

export const THUNDER_WAVE_EMITTERS = [
  // thunderwave_launch1.particle.json / launch2
  launch('launch-1', 'xl', 8, 1, 0.5, 0.25),
  launch('launch-2', 'large', 8, 0.8, 1.75, 0.75),
  // thunderwave_actor.particle.json — o ponto de saída corre o caminho
  // inteiro (`anchor: 'path'`) enquanto solta os anéis.
  {
    ...standing,
    id: 'wave',
    texture: 'medium',
    strip: 6,
    frames: { first: 0, count: 6, fps: 20 },
    start: 0,
    duration: WAVE_TRAVEL,
    rate: () => 24,
    anchor: 'path',
    direction: () => [0, 0, 1],
    speed: (ctx) => 0.4 * ctx.length,
    drag: (ctx) => 0.8 * ctx.length,
    lifetime: () => 0.3,
    size: () => 0.6,
  },
  // thunderwave_impact1.particle.json — o anel enorme no alvo.
  {
    ...standing,
    id: 'ring',
    texture: 'xl',
    strip: 8,
    frames: { first: 0, count: 8, fps: 20 },
    start: WAVE_TRAVEL,
    duration: 0.35,
    rate: () => 6,
    anchor: 'impact',
    offset: () => [0, 0, 0.2],
    direction: () => [0, 0, 1],
    speed: () => 0,
    drag: () => 0,
    lifetime: () => 0.465,
    size: () => 1.1,
  },
  // thunderwave_impact2.particle.json / impact3
  orbit('orbit-1', 'large', 8, 20, 0.8, 0.75, 0, 0.15),
  orbit('orbit-2', 'medium', 6, 16, 0.5, 0.95, Math.PI / 4, 0.175),
  // thunderwave_sparking.particle.json — faíscas de uma casca em volta do
  // ponto, quase todas pra cima.
  {
    id: 'sparks',
    texture: 'tiny',
    strip: 4,
    frames: { first: 0, count: 4, fps: 18 },
    blending: 'normal',
    start: WAVE_TRAVEL,
    duration: 0.75,
    rate: () => 30,
    anchor: 'impact',
    shellRadius: () => 0.5,
    direction: (ctx, rnd) => [
      (rnd[0] - 0.5) * between(rnd[4], 2, 4),
      (rnd[1] + 0.5) * between(rnd[5], 2, 4),
      (rnd[2] - 0.5) * between(rnd[6], 2, 4),
    ],
    speed: (ctx, rnd) => between(rnd[3], 0.55, 0.85) * 3,
    accel: () => [0, 0, 0],
    drag: () => 8,
    lifetime: () => 0.175,
    size: (t, rnd) => 0.25 - rnd[2] * 0.085,
    spin: true,
    tint: WHITE,
  },
]
