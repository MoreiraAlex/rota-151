import { compileGradient, sampleCurve } from './particleSimulation'

/**
 * Cortina de Fumaça (Smokescreen) em partículas — tradução manual das
 * definições do Cobblemon (`.exemple/Coblemon/assets/cobblemon/bedrock/
 * particles/moves/smokescreen/` e a linha do tempo em `data/cobblemon/
 * action_effects/moves/smokescreen.json`). Mesmo contrato de `ctx`/`rnd` de
 * `emberVfx.js`; todas as partículas usam o mesmo flipbook de fumaça (8
 * quadros lado a lado, tocados do último pro primeiro: `base_UV [56, 0]`,
 * `step_UV [-8, 0]`) e o mesmo gradiente cinza-escuro.
 *
 * Dois efeitos, dois grupos:
 *
 * - `SMOKESCREEN_EMITTERS` (o golpe, nasce no ponto de impacto do cone):
 *   `actor` — o sopro de fumaça saindo da boca (`smokescreen_actor`, 0.7 s);
 *   `cone`  — a nuvem ao longo do cone inteiro, de uma vez (no original,
 *   `smokescreen_actorspray` viaja da boca ao alvo; aqui o golpe é instantâneo,
 *   ver `emberVfx.js`), mais larga quanto mais longe da boca.
 * - `SMOKESCREEN_TARGET_EMITTERS` (nasce em CADA alvo atingido): a nuvem que
 *   engole o alvo (`smokescreen_target`, 0.8 s) — no original só pra quem não
 *   esquivou (`q.missed == false`), igual aqui.
 *
 * Espaço local: impacto em (0, 0, 0), criatura em (0, 0, -length), +Z na
 * direção do golpe — o eixo Z do Bedrock aponta pro lado oposto, então todo
 * `z` das direções foi INVERTIDO na tradução. O alvo roda com o `length` mínimo
 * do efeito e sem direção própria (a fumaça sai em todas as direções).
 */

export const SMOKESCREEN_TEXTURE_PATHS = {
  smoke: '/assets/effects/smokescreen/generic.png',
}

// `smokesize` (os 3 JSONs repetem a mesma curva) e o cinza escuro sorteado por
// partícula (`interpolant: v.particle_random_3`).
const SMOKE_SIZE = [0.37, 0.85, 1, 1, 1, 0.88, 0.55, 0]
const SMOKE_TINT = compileGradient([
  { at: 0, color: '#333233' },
  { at: 1, color: '#0f0f0f' },
])
const SMOKE_FRAMES = { first: 7, count: 8, step: -1, stretch: true }

const smokeBase = {
  texture: 'smoke',
  strip: 8,
  frames: SMOKE_FRAMES,
  blending: 'normal',
  spin: true,
  tint: SMOKE_TINT,
  // a cor vem de `v.particle_random_3`, não da idade
  tintAt: (t, rnd) => rnd[3],
}

// Abertura do cone visível da nuvem: metade da largura por metro de distância
// da boca (o `radius / range` do Growl/Smokescreen, 1.5 / 3 → 0.5).
const CONE_SPREAD = 0.5

export const SMOKESCREEN_EMITTERS = [
  // smokescreen_actor.particle.json — 90/s por 0.7 s, sai da boca em direção
  // ao alvo, `speed = random(1.5, 4.25) * deltaz * 0.4`.
  {
    ...smokeBase,
    id: 'actor',
    start: 0,
    duration: 0.7,
    rate: () => 90,
    anchor: 'origin',
    shellRadius: () => 0.05,
    direction: (ctx, rnd) => [
      (rnd[0] * 2 - 1) * 0.395 * 0.55,
      (rnd[1] * 0.675 - 0.4) * 0.55,
      0.5 + rnd[2] * 1.55,
    ],
    speed: (ctx, rnd) => (1.5 + rnd[3] * 2.75) * (ctx.length * 0.4),
    accel: () => [0, 0.75, 0],
    drag: () => 2,
    lifetime: (ctx, rnd) => (22 + rnd[4] * 14) / 22,
    size: (t, rnd) => 0.225 * sampleCurve(SMOKE_SIZE, t) - rnd[5] * 0.07,
  },
  // smokescreen_actorspray.particle.json — a nuvem pelo cone inteiro: 135
  // partículas (150/s × 0.9 s) espalhadas boca → ponta, mais afastadas do eixo
  // quanto mais longe, derivando devagar.
  {
    ...smokeBase,
    id: 'cone',
    start: 0,
    burst: 90,
    anchor: 'origin',
    offset: (ctx, rnd) => {
      const along = rnd[0]
      const spread = CONE_SPREAD * ctx.length * along
      return [
        ((rnd[1] * 2 - 1) * spread) / ctx.scale,
        ((rnd[2] - 0.3) * 0.5 * (0.3 + along)) / ctx.scale,
        (along * ctx.length) / ctx.scale,
      ]
    },
    direction: (ctx, rnd) => [
      (rnd[3] * 2 - 1) * 0.45,
      rnd[4] * 0.7 - 0.25,
      0.55 + rnd[5] * 1.5,
    ],
    speed: (ctx, rnd) => (2.75 + rnd[6] * 1.5) * ctx.length * 0.15,
    accel: () => [0, 0.5, 0],
    drag: () => 1,
    lifetime: (ctx, rnd) => (22 + rnd[7] * 10) / 22,
    size: (t, rnd) => 0.25 * sampleCurve(SMOKE_SIZE, t) - rnd[8] * 0.07,
  },
]

// smokescreen_target.particle.json — 210/s por 0.8 s numa casca que cresce
// (`0.1 + age * 1.9` × largura da criatura, aqui 1), subindo do meio do corpo.
export const SMOKESCREEN_TARGET_EMITTERS = [
  {
    ...smokeBase,
    id: 'target',
    start: 0,
    duration: 0.8,
    rate: () => 210,
    anchor: 'impact',
    shellRadius: (ctx) => 0.1 + ctx.age * 1.9,
    offset: (ctx) => [0, (0.333 + ctx.age * 0.1) / ctx.scale, 0],
    // vai abrindo e some do centro pra fora (`/ (age * 2)` do original)
    direction: (ctx, rnd) => [
      rnd[0] * 2 - 1,
      rnd[1] * 0.65 - 0.25,
      rnd[2] * 2 - 1,
    ],
    speed: (ctx, rnd) => 0.75 + rnd[3] * 1.5,
    accel: () => [0, 1, 0],
    drag: () => 1.5,
    lifetime: (ctx, rnd) => (22 + rnd[4] * 24) / 22,
    size: (t, rnd) => 0.325 * sampleCurve(SMOKE_SIZE, t) - rnd[5] * 0.07,
  },
]
