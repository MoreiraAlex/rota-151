import { compileGradient, sampleCurve } from './particleSimulation'
import { clamp } from './fireParticleKit'

/**
 * Dragon Breath em partículas — tradução manual das definições do Cobblemon
 * (`.exemple/Coblemon/assets/cobblemon/bedrock/particles/moves/
 * dragonbreath/` e a linha do tempo em `data/cobblemon/action_effects/moves/
 * dragonbreath.json`). Mesmo contrato de `ctx`/`rnd` de `emberVfx.js`
 * (`v.particle_random_N` = `rnd[N - 1]`); a textura é a nuvem de fogo
 * branca dos golpes de fogo, pintada de verde-azulado — a cor do anime
 * (decisão do usuário; no Cobblemon é rosa e roxo):
 *
 *   - `breath` — o sopro saindo da boca até o alvo, ondulando de um lado pro
 *     outro (`dragonbreath_actor`)
 *   - `burst`  — a explosão de energia no alvo, que sobe e se desfaz
 *     (`dragonbreath_target`)
 *
 * As duas pintadas do branco-esverdeado ao verde-água, turquesa e azul-petróleo
 * ao longo da vida. No
 * Cobblemon a explosão espera 0.25 s depois do sopro; aqui ela é imediata
 * (regra de `emberVfx.js`: depois do aviso, nada do golpe espera pra chegar
 * no impacto). O `v.target_deltaz` do original é a distância até o alvo
 * (`ctx.length`). Eixo Z do Bedrock invertido (-Z = alvo lá, +Z aqui).
 * Sem colisão com o chão.
 */

export const DRAGON_BREATH_TEXTURE_PATHS = {
  cloud: '/assets/effects/ember/cloudyfire_white.png',
}

// Branco-esverdeado → verde-água → turquesa → azul-petróleo, nos mesmos
// pontos dos gradientes do actor e do target.
const BREATH_TINT = compileGradient([
  { at: 0, color: '#e8fff6' },
  { at: 0.05, color: '#e8fff6' },
  { at: 0.2, color: '#5cffc4' },
  { at: 0.6, color: '#1cc4b4' },
  { at: 1, color: '#0b5a7a' },
])
const BURST_TINT = compileGradient([
  { at: 0, color: '#e8fff6' },
  { at: 0.35, color: '#5cffc4' },
  { at: 0.7, color: '#1cc4b4' },
  { at: 1, color: '#0b5a7a' },
])

// `variable.fun` do actor / `variable.dorasize` do target.
const BREATH_FUN = [1, 1, 1, 1, 0.99, 0.97, 0.91, 0.77, 0.54, -0.1]
const BURST_SIZE = [0.42, 0.77, 0.91, 0.98, 1, 1, 1, 1, 1, 0.86, 0.55, 0]

// `math.random(a, b)` com uma random da partícula.
const between = (r, a, b) => a + r * (b - a)

// A nuvem de fogo: 10 quadros lado a lado, 12 por segundo.
const CLOUD = {
  texture: 'cloud',
  strip: 10,
  frames: { first: 0, count: 10, fps: 12 },
  blending: 'normal',
}

export const DRAGON_BREATH_EMITTERS = [
  // dragonbreath_actor.particle.json — 1 s de sopro da boca até o alvo.
  {
    ...CLOUD,
    id: 'breath',
    start: 0,
    duration: 1,
    rate: (ctx) => 30 * clamp(ctx.length, 1, 4),
    anchor: 'origin',
    direction: (ctx, rnd) => [
      (rnd[0] - 0.5) * 1.05 + Math.sin(ctx.age * 2 * Math.PI) * 0.25,
      (rnd[1] - 0.5) * 1.05 + Math.sin(ctx.age * 3 * Math.PI) * 0.2,
      ctx.length * 1.05,
    ],
    speed: (ctx, rnd) =>
      ctx.length * ((rnd[3] + 0.75) * 1.15) * (clamp(ctx.length, 3, 24) / 1.7),
    accel: (ctx, rnd) => [
      (rnd[2] - 0.5) * 4,
      3 + (rnd[0] - 0.5) * 2,
      -(rnd[1] - 0.5),
    ],
    drag: (ctx) =>
      clamp(ctx.length, 1, 20) * (0.5 + clamp(ctx.length, 1, 5) * 0.05),
    lifetime: (ctx, rnd) => between(rnd[4], 0.75, 1) * 1.4,
    size: (t, rnd) => (0.5 - rnd[3] * 0.15) * sampleCurve(BREATH_FUN, t),
    spin: (rnd) => Math.round(rnd[3] * 3),
    tint: BREATH_TINT,
    tintAt: (t, rnd) => t * (rnd[3] + 0.75),
  },
  // dragonbreath_target.particle.json — explosão no alvo (0.3 s de emissão).
  {
    ...CLOUD,
    id: 'burst',
    start: 0,
    duration: 0.3,
    rate: () => 250,
    anchor: 'impact',
    offset: (ctx, rnd) => [0, 0, -between(rnd[4], -0.05, 0.15)],
    direction: (ctx, rnd) => [
      between(rnd[5], -2, 2) * 1.1,
      between(rnd[6], -2, 2) * 1.1,
      between(rnd[7], -2, 2) * 0.45,
    ],
    speed: (ctx, rnd) => between(rnd[8], 1.25, 4.75) * 1.25,
    accel: (ctx, rnd) => [0, between(rnd[9], 1.5, 3.5), 0],
    drag: (ctx, rnd) => between(rnd[2], 1.25, 1.5) * 2,
    lifetime: (ctx, rnd) => between(rnd[0], 0.65, 1) * 1.4,
    size: (t, rnd) => (0.5 - rnd[3] * 0.15) * sampleCurve(BURST_SIZE, t),
    spin: false,
    tint: BURST_TINT,
  },
]
