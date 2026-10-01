import { compileGradient } from './particleSimulation'
import { SPARK_TINT, TACKLE_TEXTURE_PATHS } from './tackleVfx'

/**
 * Scratch (arranhão) em partículas — tradução manual das definições do
 * Cobblemon (`.exemple/Coblemon/assets/cobblemon/bedrock/particles/moves/
 * scratch/` e a linha do tempo em `data/cobblemon/action_effects/moves/
 * scratch.json`). Mesmo contrato de `ctx`/`rnd` de `emberVfx.js`; só o
 * IMPACTO no alvo (o resto do golpe é a animação do corpo da criatura),
 * então tudo nasce no ponto de impacto, no instante em que o efeito nasce:
 *
 *   0.00  `mark`    — marca de arranhão amarela, 7 quadros ao longo de 0.35 s
 *   0.05  `sparks`  — 7 faíscas que saltam e caem (evento da marca, aos 0.05 s)
 *
 * Marca e faíscas compartilham o deslocamento do original: 0.2 m pra cima
 * e `0.5 * radius` golpe adentro (o `q.entity_radius` do alvo vira o
 * `radius` do golpe; limite de 1 m). A textura é empilhada na vertical
 * (quadro 0 = o de cima), como as do Tackle. Sem colisão com o chão.
 */

export const SCRATCH_TEXTURE_PATHS = {
  scratch: '/assets/effects/scratch/scratch_yellow.png',
  orb: TACKLE_TEXTURE_PATHS.orb,
}

// A marca não tem `minecraft:particle_appearance_tinting`: sai branca (a
// cor amarela vem da própria textura).
const MARK_TINT = compileGradient([{ at: 0, color: '#ffffff' }])

// `math.max(-0.5 * q.entity_radius, -1)` no Z do Bedrock (-Z = alvo).
const impactOffset = (ctx) => [0, 0.2, Math.min(0.5 * ctx.radius, 1)]

export const SCRATCH_EMITTERS = [
  // scratch_target.particle.json
  {
    id: 'mark',
    texture: 'scratch',
    strip: 7,
    vertical: true,
    frames: { first: 0, count: 7, step: 1, stretch: true },
    blending: 'normal',
    start: 0,
    burst: 1,
    anchor: 'impact',
    offset: impactOffset,
    direction: (ctx, rnd) => [rnd[4] * 2 - 1, rnd[5] * 2 - 1, rnd[6] * 2 - 1],
    speed: () => 0.25,
    accel: () => [0, 1, 0],
    drag: () => 10,
    lifetime: () => 0.35,
    size: () => 1,
    // `math.random_integer(0, 1) * -90`: 0° ou -90°
    spin: (rnd) => (rnd[7] < 0.5 ? 0 : -1),
    tint: MARK_TINT,
  },
  // scratch_targetsparks.particle.json
  {
    id: 'sparks',
    texture: 'orb',
    strip: 4,
    vertical: true,
    frames: { first: 2, count: 3, step: -1, stretch: true },
    blending: 'normal',
    start: 0.05,
    burst: 7,
    anchor: 'impact',
    offset: impactOffset,
    direction: (ctx, rnd) => [
      (rnd[4] * 2 - 1) * 0.9,
      -0.1 + rnd[5] * 1.2,
      (rnd[6] * 2 - 1) * 0.9,
    ],
    speed: (ctx, rnd) => 5 + rnd[7] * 2,
    accel: () => [0, -9, 0],
    drag: () => 0.25,
    lifetime: (ctx, rnd) => 0.35 + rnd[8] * 0.15,
    size: () => 0.125,
    spin: false,
    tint: SPARK_TINT,
  },
]
