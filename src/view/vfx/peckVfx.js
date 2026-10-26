import { compileGradient } from './particleSimulation'

/**
 * Bicada (Peck) em partículas. O Cobblemon não tem o golpe: é o acerto do
 * Aerial Ace (`.exemple/Coblemon/assets/cobblemon/bedrock/particles/moves/
 * aerialace/`, também Voador), sem o pulo e o pouso de quem usa. Mesmo
 * contrato de `ctx`/`rnd` de `emberVfx.js`; só o IMPACTO no alvo:
 *
 *   - `cut-1`/`cut-2` — os dois cortes cruzados (`aerialace_targetcut1` e
 *     `_targetcut2`), flipbook da varrida esticado na diagonal
 *   - `burst`         — o estouro de faíscas azuladas que cruza o alvo
 *     (`aerialace_targetburst`), caindo com a gravidade
 *
 * A linha do tempo do `aerialace_target` foi encurtada (a bicada é mais
 * rápida que o corte do Aerial Ace). Espaço local: impacto em (0, 0, 0), +Z
 * na direção do golpe — o eixo Z do Bedrock aponta pro lado oposto, então
 * todo `z` foi INVERTIDO na tradução. O tamanho no corpo do alvo fica no
 * `visual.scale` (deslocamentos, tamanho e a força do estouro).
 */

export const PECK_TEXTURE_PATHS = {
  swipe: '/assets/effects/peck/swipe.png',
  white: '/assets/effects/peck/white.png',
}

// Quando cada parte sai (s), a linha do tempo do `aerialace_target` encurtada.
const CUT_1_AT = 0
const CUT_2_AT = 0.08
export const PECK_BURST_AT = 0.1
const BURST_WINDOW = 0.125

// O azul-claro dos cortes (o `tinting.color` RGBA).
const CUT_TINT = compileGradient([{ at: 0, color: '#cbfffe' }])
// O estouro: cada faísca uma cor entre as duas pontas (o interpolante é uma
// random da partícula, não a idade).
const BURST_TINT = compileGradient([
  { at: 0, color: '#d1f5ff' },
  { at: 1, color: '#8bd0ff' },
])

const SQRT2 = Math.SQRT2

// `math.random(a, b)` com uma random da partícula.
const between = (r, a, b) => a + r * (b - a)

// O giro inicial de meia volta do original no quadro esticado: a direção ao
// contrário (vira o eixo do quadro e a face junto).
const cutBase = {
  texture: 'swipe',
  strip: 6,
  vertical: true,
  frames: { first: 0, count: 6, fps: 18 },
  facing: 'direction',
  blending: 'normal',
  burst: 1,
  anchor: 'impact',
  speed: () => 0.1,
  accel: () => [0, 0, 0],
  drag: () => 25,
  lifetime: () => 0.3,
  size: () => [1.2, 0.6],
  spin: false,
  tint: CUT_TINT,
}

export const PECK_EMITTERS = [
  // aerialace_targetcut1.particle.json — o corte de cima pra baixo.
  {
    ...cutBase,
    id: 'cut-1',
    start: CUT_1_AT,
    offset: () => [SQRT2 / 2.75 - 0.15, SQRT2 / 2.75, SQRT2 / 3.25],
    direction: () => [-1, 1, 0.5],
  },
  // aerialace_targetcut2.particle.json — o corte de baixo pra cima.
  {
    ...cutBase,
    id: 'cut-2',
    start: CUT_2_AT,
    offset: () => [-SQRT2 / 2.75, SQRT2 / 3.25, -(SQRT2 / 15 - 0.1)],
    direction: () => [-1, -1, 0.5],
  },
  // aerialace_targetburst.particle.json — o ponto de saída corre na diagonal
  // enquanto solta as faíscas.
  {
    id: 'burst',
    texture: 'white',
    strip: 1,
    frames: { first: 0, count: 1, fps: 1 },
    blending: 'normal',
    start: PECK_BURST_AT,
    duration: BURST_WINDOW,
    rate: () => 150,
    anchor: 'impact',
    offset: (ctx) => [
      -ctx.age * 10 - 0.25,
      ctx.age * 10 - 0.25,
      -(ctx.age * 5 - 0.25),
    ],
    direction: (ctx, rnd) => [
      (rnd[0] - 0.5) * 2 + 1.25,
      (rnd[1] - 0.5) * 2 + 1.25,
      -((rnd[2] - 0.5) * 2 + 0.75),
    ],
    speed: (ctx, rnd) => between(rnd[3], 6, 9) * ctx.scale,
    accel: () => [0, -9.8, 0],
    drag: () => 5,
    lifetime: (ctx, rnd) => between(rnd[5], 0.3, 0.4),
    // encolhe até sumir ao longo da vida
    size: (t) => 0.0625 * (1 - t),
    spin: false,
    tint: BURST_TINT,
    tintAt: (t, rnd) => rnd[4],
  },
]
