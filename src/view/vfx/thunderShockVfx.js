import { compileGradient, sampleCurve } from './particleSimulation'

/**
 * Choque do Trovão (Thunder Shock) em partículas — tradução manual das
 * definições do Cobblemon (`.exemple/Coblemon/assets/cobblemon/bedrock/
 * particles/moves/thundershock/` e a linha do tempo em `data/cobblemon/
 * action_effects/moves/thundershock.json`). Mesmo contrato de `ctx`/`rnd` de
 * `emberVfx.js`. Dois efeitos:
 *
 * - `THUNDER_SHOCK_CHARGE_EMITTERS` (`visual.chargeGroup:
 *   'thunder-shock-charge'`, do disparo ao `effectAt`, nos pés de quem usa):
 *   `sparks` — faíscas saltando de uma casca em volta do corpo
 *   (`thundershock_actorsparks`); `bolts` — raios curtos saindo do corpo em
 *   direções que giram (`thundershock_actorbolts`).
 * - `THUNDER_SHOCK_EMITTERS` (`visual.effectGroup: 'thunder-shock'`, no
 *   `effectAt`, no contato com o alvo): `bolt` — o raio de quem usa até o
 *   alvo (`thundershock_actor`), um quadro esticado no comprimento do golpe;
 *   no alvo, `sparks` (`thundershock_target`), `shock` — o choque amarelo
 *   (`thundershock_targetbolts`) — e `impact` — os estilhaços elétricos
 *   (`thundershock_targetimpact`).
 *
 * Espaço local do golpe: impacto em (0, 0, 0), criatura em (0, 0, -length),
 * +Z na direção do golpe — o eixo Z do Bedrock aponta pro lado oposto, então
 * todo `z` foi INVERTIDO na tradução. O `math.sin`/`math.cos` do Bedrock é em
 * GRAUS.
 */

export const THUNDER_SHOCK_TEXTURE_PATHS = {
  bolt: '/assets/effects/thunder-shock/bolt.png',
  shock: '/assets/effects/thunder-shock/electricity_yellow.png',
  crit: '/assets/effects/bite/critical_hit.png',
  electric: '/assets/effects/impact/impact_electric.png',
}

const DEG = Math.PI / 180

// `math.random(a, b)` com uma random da partícula.
const between = (r, a, b) => a + r * (b - a)

// As faíscas: do branco ao amarelo.
const SPARK_TINT = compileGradient([
  { at: 0, color: '#ffffff' },
  { at: 0.42, color: '#fff5ae' },
  { at: 1, color: '#ffe845' },
])
const WHITE = compileGradient([{ at: 0, color: '#ffffff' }])
// `variable.shrink`, `fade` e `send` dos JSONs.
const SPARK_SHRINK = [0.3, 1, 0.2, 0.9, 0.1, 0.5, 0.25, 0]
const TARGET_SHRINK = [0.3, 1, 0.2, 0.9, 0.1, 0.5, 0.21, 0.1, 0.05, 0.02, 0, 0]
const BOLT_FADE = [0.5, 1, 0.49, 1, 0, 0.5, 0, 0, 0, 0, 0, 0, 0]
const BOLT_SEND = [0, 1, 1, 1, 1, 1, 1, 1]
const ACTOR_BOLT_FADE = [1, 0.49, 1, 0.39, 0.06, 0, 0, 0, 0, 0]
const ACTOR_BOLT_SEND = [0, 0.55, 0.85, 0.97, 1, 1, 1, 1]

// A folha `bolt`: 11 quadros empilhados na vertical; o raio longo usa a
// largura inteira, o curto, a coluna do meio (de 3).
const BOLT_FRAMES = { first: 0, count: 11, fps: 30, loop: true }

const sparkBase = {
  texture: 'crit',
  strip: 1,
  frames: { first: 0, count: 1, fps: 1 },
  blending: 'normal',
  anchor: 'impact',
  direction: (ctx, rnd) => [rnd[0] - 0.5, rnd[1] - 0.35, rnd[2] - 0.5],
  accel: () => [0, -2, 0],
  drag: () => 3,
  spin: (rnd) => Math.round(rnd[0] * 3),
  tint: SPARK_TINT,
}

export const THUNDER_SHOCK_CHARGE_EMITTERS = [
  // thundershock_actorsparks.particle.json — de uma casca em volta do corpo
  // (o quadro nasce nos pés: o centro é meia altura acima).
  {
    ...sparkBase,
    id: 'sparks',
    start: 0,
    continuous: true,
    rate: () => 30,
    offset: (ctx) => [0, ctx.height / 2 / ctx.scale, 0],
    shellRadius: (ctx) => Math.max(ctx.height * 0.6, 0.15) / ctx.scale,
    speed: () => 1,
    lifetime: () => 0.3,
    size: (t, rnd) => (0.1 - rnd[3] * 0.05) * sampleCurve(SPARK_SHRINK, t),
  },
  // thundershock_actorbolts.particle.json — raios curtos a um terço da
  // altura, saindo do corpo em direções que giram com a idade do emissor.
  {
    id: 'bolts',
    texture: 'bolt',
    strip: 11,
    vertical: true,
    columns: 3,
    column: 1,
    frames: BOLT_FRAMES,
    facing: 'direction',
    pivot: 'tail',
    blending: 'normal',
    start: 0,
    continuous: true,
    rate: () => 30,
    anchor: 'impact',
    offset: (ctx) => [0, (ctx.height * 0.33) / ctx.scale, 0],
    direction: (ctx, rnd) => [
      Math.sin(ctx.age * 1658 * DEG) * (rnd[0] - 0.5),
      Math.cos(ctx.age * 2558 * DEG) * (rnd[1] - 0.25),
      -Math.cos(ctx.age * 1658 * DEG) * (rnd[2] - 0.5),
    ],
    speed: () => 0.02,
    accel: () => [0, 0, 0],
    drag: () => 0,
    lifetime: (ctx, rnd) => between(rnd[3], 0.7, 0.9),
    size: (t, rnd) => [
      sampleCurve(ACTOR_BOLT_SEND, t) * 1.5 * (rnd[4] * 0.2 + 0.5) * 1.5,
      (0.08 - rnd[4] * 0.02) * sampleCurve(ACTOR_BOLT_FADE, t),
    ],
    spin: false,
    tint: WHITE,
  },
]

export const THUNDER_SHOCK_EMITTERS = [
  // thundershock_actor.particle.json — o raio de quem usa até o alvo: nasce
  // na origem do golpe e se estica até o contato (o `target_distance`).
  {
    id: 'bolt',
    texture: 'bolt',
    strip: 11,
    vertical: true,
    frames: BOLT_FRAMES,
    facing: 'direction',
    pivot: 'tail',
    blending: 'normal',
    start: 0,
    burst: 1,
    anchor: 'origin',
    direction: () => [0, 0, 1],
    speed: () => 0.02,
    accel: () => [0, 0, 0],
    drag: () => 0,
    lifetime: () => 0.4,
    size: (t, rnd, body, length) => [
      sampleCurve(BOLT_SEND, t) * length,
      0.25 * sampleCurve(BOLT_FADE, t),
    ],
    spin: false,
    tint: WHITE,
  },
  // thundershock_target.particle.json — faíscas pra todo lado no alvo.
  {
    ...sparkBase,
    id: 'sparks',
    start: 0,
    burst: 15,
    speed: () => 5,
    lifetime: (ctx, rnd) => between(rnd[4], 0.4, 0.7),
    size: (t, rnd) => (0.1 - rnd[3] * 0.05) * sampleCurve(TARGET_SHRINK, t),
  },
  // thundershock_targetbolts.particle.json — o choque amarelo no contato.
  {
    id: 'shock',
    texture: 'shock',
    strip: 6,
    vertical: true,
    frames: { first: 0, count: 6, fps: 24 },
    blending: 'normal',
    start: 0,
    burst: 1,
    anchor: 'impact',
    offset: () => [0, 0, 0.1],
    direction: () => [0, 0, 1],
    speed: () => 0,
    accel: () => [0, 0, 0],
    drag: () => 0,
    lifetime: () => 0.27,
    size: () => 0.45,
    spin: false,
    tint: WHITE,
  },
  // thundershock_targetimpact.particle.json — estilhaços elétricos rápidos.
  {
    id: 'impact',
    texture: 'electric',
    strip: 7,
    vertical: true,
    frames: { first: 0, count: 7, stretch: true },
    blending: 'normal',
    start: 0,
    burst: 14,
    anchor: 'impact',
    direction: (ctx, rnd) => [rnd[0] - 0.5, rnd[1] - 0.5, rnd[2] - 0.5],
    speed: (ctx, rnd) => between(rnd[3], 10, 15),
    accel: () => [0, 0, 0],
    drag: () => 5,
    lifetime: (ctx, rnd) => between(rnd[4], 0.2, 0.5),
    size: (t) => 0.15 * (1 - t),
    spin: true,
    tint: WHITE,
  },
]
