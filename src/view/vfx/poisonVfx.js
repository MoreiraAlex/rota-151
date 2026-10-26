import { compileGradient, sampleCurve } from './particleSimulation'

/**
 * Veneno em partículas (docs/features/061-revisao-das-skills.md, Weedle).
 * O Cobblemon não tem o Poison Sting: o ferrão voando é nosso (escolha do
 * usuário) e o acerto é o do Poison Fang (`.exemple/Coblemon/assets/
 * cobblemon/bedrock/particles/moves/poisonfang/`). Mesmo contrato de
 * `ctx`/`rnd` de `emberVfx.js`.
 *
 * - `POISON_STING_EMITTERS` (o golpe, nasce no impacto): `stinger` — um risco
 *   roxo esticado que sai da origem e chega ao alvo; `trail` — o rastro que
 *   ele deixa; no acerto, `splash` (`poisonfang_targetimpact`, o respingo
 *   roxo pra todo lado) e `bubbles` (`poisonfang_targetbubble`, bolhas
 *   subindo).
 * - `POISON_BODY_EMITTERS` (no corpo, enquanto a criatura estiver
 *   envenenada — `StatusConditionEffectsView`): bolhas roxas subindo, no
 *   tamanho do corpo. Não existe no Cobblemon.
 *
 * Espaço local: impacto em (0, 0, 0), criatura em (0, 0, -length), +Z na
 * direção do golpe — o eixo Z do Bedrock aponta pro lado oposto, então todo
 * `z` foi INVERTIDO na tradução.
 */

export const POISON_TEXTURE_PATHS = {
  generic: '/assets/effects/string-shot/generic.png',
  bubble: '/assets/effects/poison/poisonbubble.png',
  impact: '/assets/effects/impact/impact_poison.png',
}

// Quanto o ferrão leva da origem ao alvo (s): o acerto vem quando ele chega.
export const STING_TRAVEL = 0.12
// Tamanho do risco do ferrão (m): comprimento e espessura.
const STING_LENGTH = 0.45
const STING_WIDTH = 0.07
// O respingo nasce um pouco golpe adentro (o offset em Z do Bedrock, onde -Z
// é o alvo, invertido).
const IMPACT_OFFSET = [0, 0, 0.25]

const STING_TINT = compileGradient([
  { at: 0, color: '#ffffff' },
  { at: 1, color: '#c77dff' },
])
const TRAIL_TINT = compileGradient([
  { at: 0, color: '#d8a6ff' },
  { at: 1, color: '#7a2c9e' },
])
// O roxo claro fixo dos dois JSONs do Poison Fang (`tinting.color`).
const SPLASH_TINT = compileGradient([{ at: 0, color: '#e8c8ff' }])
const BUBBLE_TINT = compileGradient([{ at: 0, color: '#d2c2ff' }])

// `variable.scale` do respingo e `variable.s` das bolhas.
const SPLASH_SIZE = [1, 0.66, 0]
const BUBBLE_SIZE = [0, 0.64, 0.95, 1, 1, 1, 1, 1, 1, 0.91, 0.62, 0]

// `math.random(a, b)` com uma random da partícula.
const between = (r, a, b) => a + r * (b - a)

// A bolha do Poison Fang: o flipbook da bolha estourando ao longo da vida
// (começa no terceiro quadro do original).
const bubbleBase = {
  texture: 'bubble',
  strip: 10,
  frames: { first: 2, count: 8, step: 1, stretch: true },
  blending: 'normal',
  spin: false,
  tint: BUBBLE_TINT,
}

export const POISON_STING_EMITTERS = [
  // O ferrão: um risco que atravessa da origem ao impacto.
  {
    id: 'stinger',
    texture: 'generic',
    strip: 8,
    frames: { first: 7, count: 1, fps: 1 },
    facing: 'direction',
    blending: 'additive',
    start: 0,
    burst: 1,
    anchor: 'origin',
    direction: () => [0, 0, 1],
    speed: (ctx) => ctx.length / STING_TRAVEL,
    accel: () => [0, 0, 0],
    drag: () => 0,
    lifetime: () => STING_TRAVEL,
    size: () => [STING_LENGTH, STING_WIDTH],
    spin: false,
    tint: STING_TINT,
  },
  // O rastro: pontos roxos deixados pelo caminho enquanto o ferrão passa.
  {
    id: 'trail',
    texture: 'generic',
    strip: 8,
    frames: { first: 7, count: 8, step: -1, stretch: true },
    blending: 'normal',
    start: 0,
    duration: STING_TRAVEL,
    rate: () => 120,
    anchor: 'path',
    direction: (ctx, rnd) => [rnd[0] - 0.5, rnd[1] - 0.5, rnd[2] - 0.5],
    speed: () => 0.2,
    accel: () => [0, 0, 0],
    drag: () => 2,
    lifetime: (ctx, rnd) => 0.2 + rnd[3] * 0.1,
    size: (t, rnd) => 0.08 - rnd[4] * 0.03,
    spin: true,
    tint: TRAIL_TINT,
  },
  // poisonfang_targetimpact.particle.json — o respingo roxo pra todo lado,
  // quando o ferrão chega.
  {
    id: 'splash',
    texture: 'impact',
    strip: 7,
    vertical: true,
    frames: { first: 0, count: 7, stretch: true },
    blending: 'normal',
    start: STING_TRAVEL,
    burst: 16,
    anchor: 'impact',
    offset: () => IMPACT_OFFSET,
    direction: (ctx, rnd) => [rnd[0] - 0.5, rnd[1] - 0.5, rnd[2] - 0.5],
    speed: (ctx, rnd) => between(rnd[3], 9.5, 12.5),
    accel: () => [0, 2, 0],
    drag: () => 5,
    lifetime: (ctx, rnd) => between(rnd[4], 0.3, 0.4),
    size: (t) => 0.25 * sampleCurve(SPLASH_SIZE, t),
    spin: true,
    tint: SPLASH_TINT,
  },
  // poisonfang_targetbubble.particle.json — bolhas numa casca em volta do
  // acerto, subindo devagar.
  {
    ...bubbleBase,
    id: 'bubbles',
    start: STING_TRAVEL,
    burst: 7,
    anchor: 'impact',
    offset: () => IMPACT_OFFSET,
    shellRadius: () => 0.75,
    direction: (ctx, rnd) => [
      between(rnd[0], -0.495, 0.495) * 0.95,
      between(rnd[1], 0.15, 0.25) * 1.05,
      between(rnd[2], -0.495, 0.495) * 0.95,
    ],
    speed: (ctx, rnd) => between(rnd[3], 0.5, 1.5),
    accel: () => [0, 0.75, 0],
    drag: () => 2,
    lifetime: (ctx, rnd) => between(rnd[5], 1.1, 1.5),
    size: (t, rnd) => (0.15 - rnd[4] * 0.05) * sampleCurve(BUBBLE_SIZE, t),
  },
]

// Corpo de quem não informa o tamanho (m) e a largura em que as bolhas têm
// o tamanho do original: elas crescem na proporção da largura do corpo.
const DEFAULT_BODY = { width: 0.6, length: 0.6, height: 0.65 }
const REFERENCE_WIDTH = 0.6
const bodyOf = (body) => body ?? DEFAULT_BODY

// Bolhas no corpo enquanto dura: quantas por segundo.
const BODY_RATE = 6

export const POISON_BODY_EMITTERS = [
  {
    ...bubbleBase,
    id: 'bubbles',
    start: 0,
    continuous: true,
    rate: () => BODY_RATE,
    anchor: 'impact',
    // um ponto qualquer dentro do corpo (o sistema nasce nos pés)
    offset: (ctx, rnd) => {
      const { width, length, height } = bodyOf(ctx.body)
      return [
        ((rnd[0] - 0.5) * width) / ctx.scale,
        ((0.2 + rnd[1] * 0.7) * height) / ctx.scale,
        ((rnd[2] - 0.5) * length) / ctx.scale,
      ]
    },
    direction: (ctx, rnd) => [(rnd[3] - 0.5) * 0.3, 1, (rnd[6] - 0.5) * 0.3],
    speed: (ctx, rnd) => 0.2 + rnd[7] * 0.2,
    accel: () => [0, 0.4, 0],
    drag: () => 1.5,
    lifetime: (ctx, rnd) => between(rnd[5], 0.9, 1.3),
    size: (t, rnd, body) =>
      (0.15 - rnd[4] * 0.05) *
      sampleCurve(BUBBLE_SIZE, t) *
      (bodyOf(body).width / REFERENCE_WIDTH),
  },
]
