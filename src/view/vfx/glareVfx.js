import { compileGradient, sampleCurve } from './particleSimulation'
import { piecewise } from './biteVfx'
import { EYE_SPREAD, LEER_TEXTURE_PATHS } from './leerVfx'

/**
 * Olhar Paralisante (Glare) e a paralisia em partículas. O Cobblemon não tem
 * o Glare: é o Scary Face (`.exemple/Coblemon/assets/cobblemon/bedrock/
 * particles/moves/scaryface/` e a linha do tempo em `data/cobblemon/
 * action_effects/moves/scaryface.json`) e as partículas de status da
 * paralisia (`particles/generic/ailments/paralysis_*`). Mesmo contrato de
 * `ctx`/`rnd` de `emberVfx.js`. Três efeitos:
 *
 * - `GLARE_GLEAM_EMITTERS` (`visual.actionGroup: 'glare'`, preso a quem usa,
 *   no `effectAt`): o brilho no olho (`scaryface_gleam`); o olho é o
 *   `visual.positionOffset`, como no Leer.
 * - `GLARE_TARGET_EMITTERS` (`targetEffectGroup: 'glare-target'`, em cada
 *   alvo atingido, no centro do corpo e virado como ele): depois da pausa
 *   (`GLARE_DELAY`, a da linha do tempo de lá, encurtada), o rosto
 *   assustador crescendo na frente dele (`scaryface_actor`) e as faíscas da
 *   paralisia pegando (`paralysis_actor`).
 * - `PARALYSIS_BODY_EMITTERS` (`visual.body: 'paralysis'` da condição, nos
 *   pés, ENQUANTO estiver paralisado): as faíscas voltando de tempos em
 *   tempos (`paralysis_passive`, com as faíscas miúdas do
 *   `paralysis_actorresidual`).
 *
 * O tamanho vem do corpo (`ctx.body`, `size(t, rnd, body)`); os deslocamentos
 * são divididos pelo `ctx.scale` (o `offset` é multiplicado por ele).
 */

export const GLARE_TEXTURE_PATHS = {
  sparkle: LEER_TEXTURE_PATHS.sparkle,
  face: '/assets/effects/glare/scaryface.png',
  spark: '/assets/effects/paralysis/paralysis_spark.png',
  tiny: '/assets/effects/paralysis/accessory_spark.png',
}

// Quanto o olhar leva pra chegar no alvo (s).
export const GLARE_DELAY = 0.3

// Corpo de quem não informa o tamanho (m), como no String Shot.
const DEFAULT_BODY = { width: 0.6, length: 0.6, height: 0.65 }
const bodyOf = (body) => body ?? DEFAULT_BODY
// O raio do corpo (o `q.entity_radius`) e o tamanho das faíscas pela altura
// (o `math.clamp(q.entity_height, 1, 1.25)`).
const bodyRadius = (body) =>
  Math.max(bodyOf(body).width, bodyOf(body).length) / 2
const sparkScale = (body) => Math.min(Math.max(bodyOf(body).height, 1), 1.25)

// `math.random(a, b)` com uma random da partícula.
const between = (r, a, b) => a + r * (b - a)

// O brilho: amarelo-claro, branco no pico.
const GLEAM_TINT = compileGradient([
  { at: 0, color: '#ffec97' },
  { at: 0.18, color: '#ffffff' },
  { at: 0.36, color: '#ffec97' },
  { at: 1, color: '#ffd675' },
])
// O rosto: branco, aparece e some (o alfa do gradiente ARGB).
const FACE_TINT = compileGradient([{ at: 0, color: '#ffffff' }])
const FACE_ALPHA = [
  [0, 0],
  [0.2, 1],
  [0.8, 1],
  [1, 0],
]
// `variable.scarysize`: o rosto cresce ao longo da vida.
const FACE_SIZE = [1, 1.34, 1.67, 1.92, 2.03, 2.09]
// As faíscas: brancas, puxando pro rosa no meio.
const SPARK_TINT = compileGradient([
  { at: 0.31, color: '#ffffff' },
  { at: 0.74, color: '#ff8b8b' },
  { at: 0.83, color: '#ffffff' },
])

export const GLARE_GLEAM_EMITTERS = [-1, 1].map((side) => ({
  // scaryface_gleam.particle.json — um brilho em cada olho (o original tem
  // um só), um pouco à frente.
  id: `gleam-${side < 0 ? 'left' : 'right'}`,
  texture: 'sparkle',
  strip: 7,
  frames: { first: 0, count: 7, fps: 14 },
  blending: 'normal',
  start: 0,
  burst: 1,
  anchor: 'impact',
  offset: () => [side * EYE_SPREAD, 0, 0.1],
  direction: () => [0, 0, 1],
  speed: () => 0,
  accel: () => [0, 0, 0],
  drag: () => 0,
  lifetime: () => 0.3,
  size: () => 0.3,
  spin: false,
  tint: GLEAM_TINT,
}))

// As faíscas saem de uma casca em volta do corpo, quase todas pra cima
// (a direção do original: um pouco pro lado, muito pra cima).
const sparkBase = {
  texture: 'spark',
  strip: 10,
  frames: { first: 0, count: 10, fps: 20 },
  blending: 'normal',
  anchor: 'impact',
  direction: (ctx, rnd) => [
    (rnd[0] * 4 - 2) * between(rnd[1], 2, 4),
    between(rnd[2], 12, 15),
    (rnd[3] * 4 - 2) * between(rnd[4], 2, 4),
  ],
  accel: () => [0, 0, 0],
  drag: () => 0,
  lifetime: () => 0.47,
  spin: true,
  tint: SPARK_TINT,
}

// O centro do corpo a partir de onde o efeito nasce: no alvo, o centro
// (`fromFeet` falso); no corpo, os pés.
const bodyCenter = (ctx, fromFeet) => [
  0,
  fromFeet ? bodyOf(ctx.body).height / 2 / ctx.scale : 0,
  0,
]
// A casca cresce com a idade do emissor (`entity_radius × (0.95 + idade)`).
const shell = (ctx) => (bodyRadius(ctx.body) * (0.95 + ctx.age)) / ctx.scale

export const GLARE_TARGET_EMITTERS = [
  // scaryface_actor.particle.json — o rosto na frente do alvo, crescendo.
  {
    id: 'face',
    texture: 'face',
    strip: 5,
    frames: { first: 0, count: 5, fps: 8 },
    blending: 'normal',
    start: GLARE_DELAY,
    burst: 1,
    anchor: 'impact',
    offset: (ctx) => {
      const { length, height } = bodyOf(ctx.body)
      return [0, (height * 0.3) / ctx.scale, (length / 2 + 0.25) / ctx.scale]
    },
    direction: () => [0, 0, 1],
    speed: () => 0.1,
    accel: () => [0, 0, 0],
    drag: () => 0,
    lifetime: () => 1,
    size: (t, rnd, body) => {
      const grow = sampleCurve(FACE_SIZE, t) * Math.max(bodyOf(body).width, 0.5)
      return [0.4 * grow, 0.28 * grow]
    },
    spin: false,
    tint: FACE_TINT,
    alpha: (t) => piecewise(FACE_ALPHA, t),
  },
  // paralysis_actor.particle.json — as faíscas pegando, de uma vez.
  {
    ...sparkBase,
    id: 'seize',
    start: GLARE_DELAY,
    duration: 0.3,
    // o original vai de 30 a 120 por segundo pelo raio do corpo; nos corpos
    // do jogo (pequenos) fica no mínimo
    rate: () => 30,
    offset: (ctx) => bodyCenter(ctx, false),
    shellRadius: shell,
    speed: (ctx, rnd) => between(rnd[5], 0.55, 0.85) * 0.8,
    size: (t, rnd, body) => (0.125 + rnd[6] * 0.1) * sparkScale(body),
  },
]

// Paralisado: a cada quantos segundos as faíscas voltam.
const PASSIVE_EVERY = 1.4

export const PARALYSIS_BODY_EMITTERS = [
  // paralysis_passive.particle.json
  {
    ...sparkBase,
    id: 'passive',
    start: 0,
    every: PASSIVE_EVERY,
    duration: 0.5,
    rate: () => 24,
    offset: (ctx) => bodyCenter(ctx, true),
    shellRadius: shell,
    speed: (ctx, rnd) => between(rnd[5], 0.55, 0.85) * 0.4,
    size: (t, rnd, body) => (0.175 - rnd[6] * 0.05) * sparkScale(body),
  },
  // paralysis_actorresidual.particle.json — as miúdas, rápidas.
  {
    ...sparkBase,
    id: 'residual',
    texture: 'tiny',
    strip: 4,
    frames: { first: 0, count: 4, fps: 20 },
    tint: compileGradient([{ at: 0, color: '#ffffff' }]),
    start: 0,
    every: PASSIVE_EVERY,
    duration: 0.4,
    rate: () => 20,
    offset: (ctx) => bodyCenter(ctx, true),
    shellRadius: shell,
    speed: (ctx, rnd) => between(rnd[5], 0.55, 0.85),
    lifetime: () => 0.15,
    size: (t, rnd, body) => (0.125 + rnd[6] * 0.1) * sparkScale(body),
  },
]
