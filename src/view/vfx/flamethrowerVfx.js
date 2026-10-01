import { compileGradient, sampleCurve } from './particleSimulation'
import { CLOUD_FUN, CLOUD_TINT, LINGER_TINT, clamp } from './fireParticleKit'

/**
 * Lança-chamas (Flamethrower) em partículas — tradução manual das
 * definições do Cobblemon (`.exemple/Coblemon/assets/cobblemon/bedrock/
 * particles/moves/flamethrower/` e a linha do tempo em `data/cobblemon/
 * action_effects/moves/flamethrower.json`). Mesmo contrato de `ctx`/`rnd`
 * e mesma convenção de eixos de `emberVfx.js` (+Z = direção do golpe, o Z
 * do Bedrock foi invertido na tradução).
 *
 * Linha do tempo (segundos desde o golpe nascer — o `effectAt`, o MESMO
 * instante do dano):
 *
 *   0.00  `actor`    — jato contínuo saindo da boca (1 s)
 *   0.00  `target`   — fogo se espalhando no alvo (0.95 s)
 *   0.00  `burst`    — estouro no alvo (0.15 s)
 *   0.30  `cinders`  — brasinhas subindo do alvo (0.95 s)
 *   0.90  `burst2`   — segundo estouro no alvo (0.15 s)
 *
 * **O golpe é instantâneo**: o dano acontece no `effectAt`, então o fogo e o
 * estouro do alvo também começam nele — no Cobblemon começam 0.25 s depois,
 * esperando o jato chegar. O próprio jato ainda leva uma fração de segundo
 * pra se estender até o alvo (é um jato contínuo que sai da boca); só o que
 * acontece NO alvo é imediato. Regra pra todo efeito novo: depois do aviso,
 * nada do golpe espera pra chegar no impacto.
 *
 * Diferenças pro original:
 * - O original fixa `v.target_deltaz = 5` no `actor` (o jato alcança o
 *   mesmo tanto, longe ou perto). Aqui as velocidades do jato escalam por
 *   `length / 5`, pra ele alcançar o ALVO do golpe (`range` da skill).
 * - `cinders`: no original cada partícula do `target` solta uma brasinha
 *   ao chegar a 30% da vida (`flamethrower_targetcinder`, evento de
 *   partícula). O motor não tem evento por partícula, então vira um
 *   emissor próprio de taxa contínua, ao redor do impacto.
 * - Sem colisão (`particle_motion_collision`) e sem
 *   `flamethrower_target_linger` (o JSON do golpe não o chama).
 * - É um efeito pesado (o `actor` solta 150 partículas/s): se pesar, baixe
 *   `density` no componente em vez de mexer nos números daqui.
 */

// `math.sin(x * 360)` do Molang é em GRAUS: 1 volta por unidade de `x`.
const turns = (value) => Math.sin(value * Math.PI * 2)

const ACTOR_TINT = compileGradient([
  { at: 0, color: '#b3f6ff' },
  { at: 0.05, color: '#ffffff' },
  { at: 0.15, color: '#ffe872' },
  { at: 0.3, color: '#ffcc00' },
  { at: 0.5, color: '#ff8700' },
  { at: 0.75, color: '#ff4700' },
  { at: 1, color: '#a31f00' },
])
// `variable.fun` do actor (flamethrower_actor.particle.json).
const ACTOR_FUN = [1, 1, 1, 1, 0.99, 0.97, 0.91, 0.77, 0.54, -0.1]

// Estouro e fogo do alvo compartilham tudo, só mudam taxa/duração/velocidade.
const targetCloud = {
  texture: 'cloud',
  strip: 10,
  frames: { first: 1, count: 9, fps: 20 },
  blending: 'normal',
  anchor: 'impact',
  accel: (ctx, rnd) => [
    (rnd[0] - 0.5) * 5,
    4 + (rnd[1] - 0.5) * 3,
    (rnd[2] - 0.5) * 5,
  ],
  lifetime: (ctx, rnd) => 0.55 + rnd[8] * 0.6,
  size: (t, rnd) => (0.5 - rnd[3] * 0.15) * sampleCurve(CLOUD_FUN, t),
  spin: true,
  tint: CLOUD_TINT,
}

export const FLAMETHROWER_EMITTERS = [
  // flamethrower_actor.particle.json — `target_deltaz` = 5, `deltax/y` = 0.
  {
    id: 'actor',
    texture: 'cloud',
    strip: 10,
    frames: { first: 0, count: 10, fps: 12 },
    blending: 'normal',
    start: 0,
    duration: 1,
    rate: () => 30 * clamp(5, 1, 7),
    anchor: 'origin',
    direction: (ctx, rnd) => [
      (rnd[0] - 0.5) * 1.15 + turns(ctx.age) * 0.35,
      (rnd[1] - 0.5) * 1.05 + turns(ctx.age * 1.5) * 0.3,
      5,
    ],
    speed: (ctx, rnd) =>
      5 * ((rnd[3] + 0.75) * 1.25) * (clamp(5, 3, 24) / 2) * (ctx.length / 5),
    accel: (ctx, rnd) => [
      (rnd[2] - 0.5) * 4,
      3 + (rnd[3] - 0.5) * 2,
      (rnd[1] - 0.5) * 1,
    ],
    drag: () => 5 * (0.5 + clamp(5, 1, 5) * 0.05),
    lifetime: (ctx, rnd) => (0.65 + rnd[8] * 0.35) * 1.4,
    size: (t, rnd) => (0.5 - rnd[3] * 0.15) * sampleCurve(ACTOR_FUN, t),
    spin: true,
    tint: ACTOR_TINT,
    // `interpolant` do original: a cor anda mais rápido ou devagar por partícula.
    tintAt: (t, rnd) => t * (rnd[3] + 0.75),
  },
  // flamethrower_target.particle.json
  {
    ...targetCloud,
    id: 'target',
    start: 0,
    duration: 0.95,
    rate: () => 90,
    direction: (ctx, rnd) => [
      (rnd[4] * 2 - 1) * 1.55,
      (rnd[5] * 2 - 1) * 1.55,
      (rnd[6] * 2 - 1) * 0.85,
    ],
    speed: (ctx, rnd) => 3 + rnd[7] * 5.5,
    drag: () => 3,
  },
  // flamethrower_targetburst.particle.json (dois estouros, 0.25 s e 0.9 s)
  ...[
    { id: 'burst', start: 0 },
    { id: 'burst2', start: 0.9 },
  ].map(({ id, start }) => ({
    ...targetCloud,
    id,
    start,
    duration: 0.15,
    rate: () => 300,
    direction: (ctx, rnd) => [
      (rnd[4] * 2 - 1) * 1.55,
      (rnd[5] * 2 - 1) * 1.55,
      (rnd[6] * 2 - 1) * 0.85 * 1.15,
    ],
    speed: (ctx, rnd) => (3 + rnd[7] * 5.5) * 1.85,
    drag: () => 4,
  })),
  // flamethrower_targetcinder.particle.json (aproximado, ver cabeçalho)
  {
    id: 'cinders',
    texture: 'ember',
    strip: 5,
    frames: { first: 0, count: 5, fps: 20 },
    blending: 'additive',
    start: 0.3,
    duration: 0.95,
    rate: () => 40,
    anchor: 'impact',
    shellRadius: () => 0.5,
    direction: (ctx, rnd) => [
      (rnd[4] * 2 - 1) * 1.5,
      rnd[5] * 2,
      (rnd[6] * 2 - 1) * 1.5,
    ],
    speed: (ctx, rnd) => (2.75 + rnd[7] * 2) * 0.45,
    accel: () => [0, 6, 0],
    drag: () => 2,
    lifetime: () => 0.25,
    size: () => 0.1,
    spin: false,
    tint: LINGER_TINT,
  },
]
