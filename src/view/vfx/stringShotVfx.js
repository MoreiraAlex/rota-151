import { compileGradient, sampleCurve } from './particleSimulation'

/**
 * String Shot em partículas — tradução manual das definições do Cobblemon
 * (`.exemple/Coblemon/assets/cobblemon/bedrock/particles/moves/stringshot/`
 * e a linha do tempo em `data/cobblemon/action_effects/moves/
 * stringshot.json`). Mesmo contrato de `ctx`/`rnd` de `emberVfx.js`; o
 * borrifo e os fios do alvo usam o flipbook de partícula genérica do
 * Smokescreen (do último quadro pro primeiro) e a teia, o `wrap` (o anel
 * inteiro se desfazendo).
 *
 * Três efeitos:
 *
 * - `STRING_SHOT_EMITTERS` (o golpe, nasce na boca): `threads` — os fios
 *   (`stringshot_actor`), quadros finos esticados na direção do movimento que
 *   saem da boca e se abrem no leque do cone; `spray` — o borrifo de seda
 *   junto (`stringshot_actorspray`).
 * - `STRING_SHOT_TARGET_EMITTERS` (nasce em CADA alvo atingido, depois da
 *   pausa da linha do tempo de lá): `strands1`/`strands2` — fios girando em
 *   volta do corpo (`stringshot_target1`/`2`) — e `wrap` — o anel de teia
 *   subindo e descendo (`stringshot_targetwrap`).
 * - `STRING_SHOT_WEB_EMITTERS` (no corpo, ENQUANTO a Velocidade estiver
 *   baixa pela teia — `StatusConditionEffectsView`): anéis de teia parados
 *   em volta do corpo, renovando devagar. Não existe no Cobblemon (lá o
 *   golpe não deixa nada); usa o primeiro quadro do mesmo `wrap`.
 *
 * Espaço local: impacto em (0, 0, 0), criatura em (0, 0, -length), +Z na
 * direção do golpe — o eixo Z do Bedrock aponta pro lado oposto, então todo
 * `z` das direções foi INVERTIDO na tradução. O `math.sin`/`math.cos` do
 * Bedrock é em GRAUS.
 */

export const STRING_SHOT_TEXTURE_PATHS = {
  generic: '/assets/effects/string-shot/generic.png',
  wrap: '/assets/effects/string-shot/wrap.png',
}

const DEG = Math.PI / 180

// `smokesize` (borrifo e fios do alvo), `send` (o fio cresce e recolhe) e
// `fade` (a espessura do fio) dos JSONs.
const SMOKE_SIZE = [0.37, 0.85, 1, 1, 1, 0.88, 0.55, 0]
const THREAD_SEND = [0, 1, 1, 0.95, 0.8, 0.5, 0.1]
const THREAD_FADE = [0.46, 1, 1, 0.3, 0.1, 0.03, 0, 0, 0.05, 0, 0]

// Seda: branco puxando pro cinza-esverdeado, sorteado por partícula
// (`interpolant: v.particle_random_3`).
const SILK_TINT = compileGradient([
  { at: 0, color: '#ffffff' },
  { at: 1, color: '#8c907e' },
])
// O fio escurece até a metade da vida (`v.particle_age / v.particle_lifetime`).
const THREAD_TINT = compileGradient([
  { at: 0, color: '#ffffff' },
  { at: 0.5, color: '#6e7164' },
])
// A teia clareia pro fim da vida.
const WRAP_TINT = compileGradient([
  { at: 0, color: '#ffffff' },
  { at: 0.85, color: '#cfd0c6' },
])

const silkBase = {
  texture: 'generic',
  strip: 8,
  frames: { first: 7, count: 8, step: -1, stretch: true },
  blending: 'normal',
  spin: true,
  tint: SILK_TINT,
  tintAt: (t, rnd) => rnd[3],
}

// Comprimento máximo do fio (m) e espessura. O spec de tamanho não enxerga o
// `ctx`: o comprimento acompanha o alcance do cone — ajuste junto dele.
const THREAD_LENGTH = 3
const THREAD_WIDTH = 0.03
// O fio quase não anda (a velocidade do original): ela só dá a direção do
// quadro, que cresce a partir da boca (`pivot: 'tail'`).
const THREAD_SPEED = 0.02
// Quanto do leque do cone os fios e o borrifo cobrem.
const CONE_FILL = 0.9

// Uma direção dentro do leque do cone (`ctx.radius` é a meia-largura na
// ponta, `ctx.length` o alcance).
const insideCone = (ctx, rnd, a, b, lift) => [
  (rnd[a] * 2 - 1) * (ctx.radius / Math.max(ctx.length, 1e-3)) * CONE_FILL,
  (rnd[b] - 0.5) * lift,
  1,
]

export const STRING_SHOT_EMITTERS = [
  // stringshot_actor.particle.json — quadro `lookat_direction` com o
  // comprimento pela curva `send` e a espessura pela `fade`. Todos nascem no
  // mesmo ponto da boca e crescem dali pro leque (no original o quadro cresce
  // pros dois lados do centro).
  {
    id: 'threads',
    texture: 'generic',
    strip: 8,
    frames: { first: 7, count: 1, fps: 1 },
    facing: 'direction',
    pivot: 'tail',
    blending: 'normal',
    start: 0,
    duration: 0.75,
    rate: () => 25,
    anchor: 'origin',
    direction: (ctx, rnd) => insideCone(ctx, rnd, 0, 1, 0.25),
    speed: () => THREAD_SPEED,
    accel: () => [0, 0, 0],
    drag: () => 0,
    lifetime: () => 1.5,
    size: (t) => [
      Math.max(THREAD_LENGTH * sampleCurve(THREAD_SEND, t), 1e-3),
      THREAD_WIDTH * Math.max(sampleCurve(THREAD_FADE, t), 0.2),
    ],
    spin: false,
    tint: THREAD_TINT,
  },
  // stringshot_actorspray.particle.json — casca pequena na boca, rumo ao
  // alvo com espalhamento.
  {
    ...silkBase,
    id: 'spray',
    start: 0,
    duration: 1,
    rate: () => 30,
    anchor: 'origin',
    shellRadius: () => 0.05,
    direction: (ctx, rnd) => insideCone(ctx, rnd, 0, 1, 0.395 * 1.3 * 2),
    speed: (ctx, rnd) => 1.5 + rnd[2] * 1.75,
    accel: () => [0, 0.2, 0],
    drag: () => 2,
    lifetime: (ctx, rnd) => 0.6 + rnd[4] * 0.2,
    size: (t, rnd) => 0.2 * sampleCurve(SMOKE_SIZE, t) - rnd[3] * 0.07,
  },
]

// A pausa da linha do tempo do Cobblemon entre os fios saírem e grudarem.
const TARGET_DELAY = 0.3
// Corpo de quem não informa o tamanho (m): o `math.clamp` mínimo dos JSONs.
const DEFAULT_BODY = { width: 0.6, length: 0.6, height: 0.65 }
// Tamanho do corpo usado pros fiapos e fios (m): eles crescem na proporção da
// largura de quem está enrolado.
const REFERENCE_WIDTH = 0.6

const bodyOf = (body) => body ?? DEFAULT_BODY
// Quanto os fiapos crescem pelo corpo.
const silkScale = (body) => bodyOf(body).width / REFERENCE_WIDTH

// Quanto a teia passa do corpo, de lado e de frente (o `entity_width × 0.85`
// do original é o raio, quase o corpo inteiro).
const ORBIT = 0.85
const WRAP = 1.15

// stringshot_target1/2.particle.json — o ponto de emissão gira em volta do
// corpo (`sin`/`cos` da idade do emissor, em graus), numa elipse do tamanho
// dele e subindo e descendo na altura dele. O efeito nasce no centro do
// corpo, virado como ele (+Z a frente).
const orbitStrands = (id, spinXZ, spinY, swap) => ({
  ...silkBase,
  id,
  start: TARGET_DELAY,
  duration: 1.66,
  rate: () => 30,
  anchor: 'impact',
  offset: (ctx) => {
    const { width, length, height } = bodyOf(ctx.body)
    const a = Math.sin(ctx.age * spinXZ * DEG)
    const b = Math.cos(ctx.age * spinXZ * DEG)
    const y = (Math.sin(ctx.age * spinY * DEG) * height) / 2
    return [
      ((swap ? b : a) * width * ORBIT) / ctx.scale,
      y / ctx.scale,
      ((swap ? a : b) * length * ORBIT) / ctx.scale,
    ]
  },
  direction: (ctx, rnd) => [
    (rnd[0] * 2 - 1) * 0.2,
    (rnd[1] * 2 - 1) * 0.2,
    (rnd[2] * 2 - 1) * 0.2,
  ],
  speed: (ctx, rnd) => (1.5 + rnd[5] * 1.75) * 0.25,
  accel: () => [0, 0.2, 0],
  drag: () => 2,
  lifetime: (ctx, rnd) => 0.6 + rnd[4] * 0.2,
  size: (t, rnd, body) =>
    (0.15 * sampleCurve(SMOKE_SIZE, t) - rnd[3] * 0.07) * silkScale(body),
})

// O anel deitado no tamanho do corpo: [de frente, de lado] (o quadro `plane`
// fica ao longo da frente do efeito).
const ring = (body, factor) => {
  const { width, length } = bodyOf(body)
  return [length * factor, width * factor]
}

export const STRING_SHOT_TARGET_EMITTERS = [
  orbitStrands('strands1', 1000, 720, false),
  orbitStrands('strands2', 1200, 540, true),
  // stringshot_targetwrap.particle.json — o anel deitado
  // (`emitter_transform_xz`) subindo e descendo no corpo, o flipbook inteiro
  // numa vida curta.
  {
    id: 'wrap',
    texture: 'wrap',
    strip: 9,
    frames: { first: 0, count: 9, fps: 22 },
    facing: 'plane',
    blending: 'normal',
    start: TARGET_DELAY,
    duration: 1.66,
    rate: () => 30,
    anchor: 'impact',
    offset: (ctx) => [
      0,
      (Math.sin(ctx.age * 2133 * DEG) * bodyOf(ctx.body).height) /
        2 /
        ctx.scale,
      0,
    ],
    direction: () => [0, 0, 1],
    // parado: o quadro `plane` se orienta pela velocidade (o original deriva
    // um pouco na vertical, o que deixaria o anel de pé)
    speed: () => 0,
    accel: () => [0, 0, 0],
    drag: () => 0,
    lifetime: () => 0.4,
    size: (t, rnd, body) => ring(body, WRAP),
    spin: false,
    tint: WRAP_TINT,
  },
]

// Teia no corpo enquanto dura: quanto o anel passa do corpo, quantos anéis
// por segundo e a vida de cada um. O sistema nasce nos pés, virado como a
// criatura.
const WEB_RING = 1.2
const WEB_RATE = 5
const WEB_LIFETIME = 1.2

export const STRING_SHOT_WEB_EMITTERS = [
  {
    id: 'web',
    texture: 'wrap',
    strip: 9,
    frames: { first: 0, count: 1, fps: 1 },
    facing: 'plane',
    blending: 'normal',
    start: 0,
    continuous: true,
    rate: () => WEB_RATE,
    anchor: 'impact',
    // em qualquer altura do corpo
    offset: (ctx, rnd) => [
      0,
      ((0.1 + rnd[0] * 0.75) * bodyOf(ctx.body).height) / ctx.scale,
      0,
    ],
    direction: () => [0, 0, 1],
    speed: () => 0,
    accel: () => [0, 0, 0],
    drag: () => 0,
    lifetime: () => WEB_LIFETIME,
    size: (t, rnd, body) => ring(body, WEB_RING * (0.9 + rnd[1] * 0.2)),
    spin: false,
    tint: WRAP_TINT,
  },
  // fiapos de seda soltos no corpo
  {
    ...silkBase,
    id: 'fluff',
    start: 0,
    continuous: true,
    rate: () => 6,
    anchor: 'impact',
    offset: (ctx, rnd) => {
      const { width, length, height } = bodyOf(ctx.body)
      return [
        ((rnd[0] - 0.5) * width) / ctx.scale,
        ((0.15 + rnd[1] * 0.7) * height) / ctx.scale,
        ((rnd[2] - 0.5) * length) / ctx.scale,
      ]
    },
    direction: (ctx, rnd) => [(rnd[5] - 0.5) * 0.4, -1, (rnd[6] - 0.5) * 0.4],
    speed: () => 0.15,
    accel: () => [0, 0, 0],
    drag: () => 1,
    lifetime: (ctx, rnd) => 0.8 + rnd[4] * 0.4,
    size: (t, rnd, body) =>
      (0.12 * sampleCurve(SMOKE_SIZE, t) - rnd[3] * 0.04) * silkScale(body),
  },
]
