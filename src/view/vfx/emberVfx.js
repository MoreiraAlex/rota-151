import { compileGradient, sampleCurve } from './particleSimulation'
import { CLOUD_FUN, CLOUD_TINT, LINGER_TINT, clamp } from './fireParticleKit'

/**
 * Brasa (Ember) em partículas — tradução manual das definições do Cobblemon
 * (`.exemple/Coblemon/assets/cobblemon/bedrock/particles/moves/ember/` e a
 * linha do tempo em `data/cobblemon/action_effects/moves/ember.json`).
 * Cada emissor abaixo cita o arquivo de origem; os números são os mesmos,
 * só que as expressões Molang viraram funções JS (ver
 * `particleSimulation.js` pra o contrato de `ctx`/`rnd`).
 *
 * Camadas, na ordem em que nascem a partir do golpe (o `effectAt`, o MESMO
 * instante do dano):
 *
 *   - `actor`   — nuvem de fogo saindo da boca
 *   - `stream`  — brasas ao longo de TODO o trajeto, de uma vez
 *   - `sparks`  — faíscas ao longo de TODO o trajeto, de uma vez
 *   - `burst`   — estouro de fogo no alvo
 *   - `linger`  — brasas que ficam subindo do alvo
 *
 * **O golpe é instantâneo**: o dano acontece no `effectAt`, então o visual
 * também chega no impacto no mesmo instante — sem viajar. No Cobblemon as
 * brasas e as faíscas andam da boca ao alvo em 0.45 s e o estouro vem aos
 * 0.5 s; aqui elas nascem espalhadas no trajeto inteiro (`anchor: 'line'`,
 * `burst`) e o estouro é imediato. Vale como regra pra todo efeito novo:
 * depois do aviso, nada do golpe espera pra chegar no impacto.
 *
 * Espaço local: impacto em (0, 0, 0), criatura em (0, 0, -length), +Z na
 * direção do golpe. O eixo Z do Bedrock aponta pro lado oposto (-Z = alvo),
 * então todo `z` das direções/acelerações foi INVERTIDO na tradução.
 *
 * Os valores são pra ajustar vendo em jogo (tamanho do efeito: `visual.scale`
 * da skill; o resto, aqui).
 */

const EMBER_TINT = compileGradient([
  { at: 0.15, color: '#ffffff' },
  { at: 1, color: '#ff4600' },
])
const SPARK_TINT = compileGradient([
  { at: 0.0, color: '#fff8c3' },
  { at: 0.34, color: '#ffe500' },
  { at: 1, color: '#ff4600' },
])

// `variable.shrink` do burst / `variable.embsize` da brasa: curvas por nós
// igualmente espaçados ao longo da vida (a `fun` do actor é a CLOUD_FUN).
const BURST_SHRINK = [1, 1, 1, 1, 1, 0.94, 0.68, 0]
const EMBER_SIZE = [1, 1, 1, 0]

export const EMBER_EMITTERS = [
  // ember_actor.particle.json — `v.target_deltaz` fixo em 5 (creation_expression).
  {
    id: 'actor',
    texture: 'cloud',
    strip: 10,
    frames: { first: 1, count: 9, fps: 20 },
    blending: 'normal',
    start: 0,
    duration: 0.1,
    rate: () => 90,
    anchor: 'origin',
    direction: (ctx, rnd) => [
      (rnd[0] - 0.5) * 1.25 * 5,
      (rnd[1] - 0.5) * 1.5 * 5,
      5 / (Math.max(ctx.age, 0.01) * 15),
    ],
    speed: (ctx, rnd) => (rnd[3] + 0.33) * 8.5 - ctx.age,
    accel: (ctx, rnd) => [
      (rnd[0] - 0.5) * 4,
      2 + (rnd[1] - 0.5) * 3,
      (0.75 - rnd[2]) * 4,
    ],
    drag: () => 5,
    lifetime: (ctx, rnd) => 0.675 + rnd[4] * 0.275,
    size: (t, rnd) => 0.4 * sampleCurve(CLOUD_FUN, t) - rnd[3] * 0.2,
    spin: true,
    tint: CLOUD_TINT,
  },
  // ember_fire.particle.json — brasas pelo trajeto inteiro (no original viajam
  // da boca ao alvo em 0.45 s; aqui nascem espalhadas, de uma vez).
  {
    id: 'stream',
    texture: 'ember',
    strip: 5,
    frames: { first: 0, count: 5, fps: 20 },
    blending: 'additive',
    start: 0,
    // 60/s × 0.45 s do original
    burst: 27,
    anchor: 'line',
    shellRadius: (ctx) => 0.1 + ctx.age * 0.25,
    direction: (ctx, rnd) => [(rnd[0] - 0.5) * 0.33, (rnd[1] - 0.5) * 0.33, 1],
    // devagar: já nasceram espalhadas no trajeto, só derivam (o original,
    // viajando, usava `length * 1.25`)
    speed: () => 1.5,
    accel: (ctx, rnd) => [0, (rnd[2] + 0.5) * 2.5, 0],
    drag: (ctx) => 2.5 + ctx.age * 2,
    lifetime: () => 0.38,
    size: (t) => 0.1 * sampleCurve(EMBER_SIZE, t),
    spin: false,
    tint: EMBER_TINT,
  },
  // ember_firesparks.particle.json — faíscas junto com as brasas.
  {
    id: 'sparks',
    texture: 'powder',
    strip: 11,
    frames: { first: 0, count: 11, fps: 20 },
    blending: 'additive',
    start: 0,
    // `clamp(5 * length, 10, 20)` por segundo × 0.45 s do original
    burst: (ctx) => Math.round(clamp(5 * ctx.length, 10, 20) * 0.45),
    anchor: 'line',
    shellRadius: () => 0.1,
    direction: (ctx, rnd) => [(rnd[0] - 0.5) * 0.33, (rnd[1] - 0.5) * 0.33, 1],
    speed: () => 1.2,
    accel: (ctx, rnd) => [0, (rnd[0] + 0.5) * 4, 0],
    drag: () => 4,
    lifetime: () => 0.38,
    size: () => 0.25,
    spin: true,
    tint: SPARK_TINT,
  },
  // ember_target.particle.json — estouro no alvo (no original, 0.5 s depois do
  // início, quando as brasas chegavam; aqui, no instante do golpe).
  {
    id: 'burst',
    texture: 'cloud',
    strip: 10,
    frames: { first: 3, count: 7, fps: 16 },
    blending: 'normal',
    start: 0,
    duration: 0.05,
    rate: () => 210,
    anchor: 'impact',
    direction: (ctx, rnd) => [
      (rnd[0] - 0.5) * 2,
      (rnd[1] - 0.6) * 2,
      -0.35 + rnd[6] * 1.2,
    ],
    speed: (ctx, rnd) => 5 + rnd[5] * 5,
    accel: (ctx, rnd) => [
      (rnd[0] - 0.5) * 4,
      4 + (rnd[0] - 0.5) * 3,
      (rnd[0] - 0.5) * 3,
    ],
    drag: () => 4,
    lifetime: (ctx, rnd) => 0.45 + rnd[4] * 0.4,
    size: (t, rnd) => (0.45 - rnd[3] * 0.1) * sampleCurve(BURST_SHRINK, t),
    spin: true,
    tint: CLOUD_TINT,
  },
  // ember_targetlinger.particle.json — brasas que sobem do alvo (nascem 0.1 s
  // depois do burst, via evento "linger"). `ctx.radius` faz o papel do
  // `q.entity_radius` original.
  {
    id: 'linger',
    texture: 'ember',
    strip: 5,
    frames: { first: 0, count: 5, fps: 20 },
    blending: 'additive',
    start: 0.1,
    duration: 0.5,
    rate: () => 40,
    anchor: 'impact',
    shellRadius: (ctx) => clamp(ctx.radius * (0.65 + ctx.age), 0.4, 1.6),
    direction: (ctx, rnd) => [
      (rnd[0] - 0.5) * 3,
      rnd[1] * 2,
      (rnd[2] - 0.5) * 3,
    ],
    speed: (ctx, rnd) => (2.75 + rnd[5] * 2) * 0.45,
    accel: () => [0, 6, 0],
    drag: () => 2,
    lifetime: () => 0.25,
    size: () => 0.1,
    spin: false,
    tint: LINGER_TINT,
  },
]
