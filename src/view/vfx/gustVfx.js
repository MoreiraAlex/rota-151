import { compileGradient, sampleCurve } from './particleSimulation'

/**
 * Lufada de Vento (Gust) em partículas — tradução manual das definições do
 * Cobblemon (`.exemple/Coblemon/assets/cobblemon/bedrock/particles/moves/
 * gust/` e a linha do tempo em `data/cobblemon/action_effects/moves/
 * gust.json`). Mesmo contrato de `ctx`/`rnd` de `emberVfx.js`; as lufadas
 * usam o flipbook de partícula genérica (do último quadro pro primeiro) e o
 * acerto, o redemoinho `gust`.
 *
 *   - `wind`   — as lufadas saindo da criatura e correndo até o alvo
 *     (`gust_actor`). No original o ponto de saída anda até a metade do
 *     caminho; aqui ele percorre o caminho inteiro (`anchor: 'path'`) e a
 *     força acompanha a distância, pro vento chegar ao alvo perto ou longe.
 *   - `puffs`  — o sopro estourando pra todo lado no alvo (`gust_target`)
 *   - `swirl`  — o redemoinho no alvo (`gust_targethit`)
 *
 * O acerto vem quando o vento chega (`GUST_TRAVEL`, a pausa da linha do tempo
 * de lá), um pouco golpe adentro do contato. Espaço local: impacto em
 * (0, 0, 0), criatura em (0, 0, -length), +Z na direção do golpe — o eixo Z
 * do Bedrock aponta pro lado oposto, então todo `z` foi INVERTIDO na tradução.
 */

export const GUST_TEXTURE_PATHS = {
  generic: '/assets/effects/string-shot/generic.png',
  gust: '/assets/effects/gust/gust.png',
}

// Quanto o vento leva pra chegar ao alvo (s).
export const GUST_TRAVEL = 0.3
// Quanto dura a saída das lufadas (s): a frente do vento corre o caminho
// nesse tempo.
const WIND_WINDOW = 0.2
// A distância (m) em que as lufadas têm a força do original (o
// `v.target_deltaz` do JSON): mais longe, mais forte, na proporção.
const REFERENCE_DISTANCE = 5
// O acerto um pouco golpe adentro (o offset em Z do Bedrock, invertido).
const HIT_OFFSET = [0, 0, 0.4]

// Azul-claro meio transparente (o `tinting.color` RGBA das lufadas).
const WIND_TINT = compileGradient([{ at: 0, color: '#d5e6ff' }])
const WIND_OPACITY = 0.63
// O redemoinho: do branco-azulado ao azul (o gradiente ARGB).
const SWIRL_TINT = compileGradient([
  { at: 0, color: '#effeff' },
  { at: 1, color: '#afd0ef' },
])
const SWIRL_OPACITY = 0xb0 / 255

// `variable.debrissize` de cada JSON.
const WIND_SIZE = [0, 1, 1, 0.89, 0.59, 0]
const PUFF_SIZE = [0, 1, 0.69, 0.35, 0]

// `math.random(a, b)` com uma random da partícula.
const between = (r, a, b) => a + r * (b - a)

const puffBase = {
  texture: 'generic',
  strip: 8,
  frames: { first: 7, count: 8, step: -1, fps: 12 },
  blending: 'normal',
  spin: true,
  tint: WIND_TINT,
  opacity: WIND_OPACITY,
}

export const GUST_EMITTERS = [
  // gust_actor.particle.json — as lufadas, mais fortes no começo e abrindo
  // menos pro lado com o tempo.
  {
    ...puffBase,
    id: 'wind',
    start: 0,
    duration: WIND_WINDOW,
    rate: () => 90,
    anchor: 'path',
    direction: (ctx, rnd) => [
      between(rnd[0], -1.1, 1.1) / ((ctx.age + 0.25) * 5),
      between(rnd[1], -0.8, 0.8),
      between(rnd[2], 0.95, 1.15),
    ],
    speed: (ctx) =>
      (8 - ctx.age * 4) * (Math.max(ctx.length, 0.5) / REFERENCE_DISTANCE),
    accel: () => [0, 2, 0],
    drag: () => 3,
    lifetime: (ctx, rnd) => between(rnd[3], 0.6, 0.7) * 1.2,
    size: (t) => 0.2 * sampleCurve(WIND_SIZE, t),
  },
  // gust_target.particle.json — o sopro estourando de uma casca pequena.
  {
    ...puffBase,
    id: 'puffs',
    start: GUST_TRAVEL,
    burst: 20,
    anchor: 'impact',
    offset: () => HIT_OFFSET,
    shellRadius: () => 0.1,
    direction: (ctx, rnd) => [rnd[0] - 0.5, rnd[1] - 0.5, rnd[2] - 0.5],
    speed: (ctx, rnd) => between(rnd[3], 2.5, 3.25) * 2.85,
    accel: () => [0, 3, 0],
    drag: () => 4,
    lifetime: (ctx, rnd) => between(rnd[4], 0.6, 0.7),
    size: (t) => 0.25 * sampleCurve(PUFF_SIZE, t),
  },
  // gust_targethit.particle.json — o redemoinho, do sexto quadro em diante,
  // esticado na vida dele.
  {
    id: 'swirl',
    texture: 'gust',
    strip: 12,
    frames: { first: 5, count: 7, stretch: true },
    blending: 'normal',
    start: GUST_TRAVEL,
    burst: 1,
    anchor: 'impact',
    offset: () => HIT_OFFSET,
    direction: () => [0, 0, 1],
    speed: () => 0,
    accel: () => [0, 0, 0],
    drag: () => 0,
    lifetime: () => 0.48,
    size: () => 1,
    spin: false,
    tint: SWIRL_TINT,
    opacity: SWIRL_OPACITY,
  },
]
