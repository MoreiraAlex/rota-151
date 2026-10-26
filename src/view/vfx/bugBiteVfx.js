import { compileGradient, sampleCurve } from './particleSimulation'
import { piecewise } from './biteVfx'

/**
 * Picada (Bug Bite) em partículas. O Cobblemon não tem o golpe: é a mordida
 * do Leech Life (`.exemple/Coblemon/assets/cobblemon/bedrock/particles/
 * moves/leechlife/`, escolha do usuário), sem a drenagem. Mesmo contrato de
 * `ctx`/`rnd` de `emberVfx.js`; só o IMPACTO no alvo:
 *
 *   - `fang`   — as presas de inseto fechando (`leechlife_target`), um
 *     flipbook empilhado na vertical (quadro 0 = o de cima) que aparece e
 *     some num laranja quente
 *   - `sparks` — faíscas pra todo lado (`leechlife_targetspark`), disparadas
 *     no meio da mordida (o evento da linha do tempo da partícula)
 *
 * Os dois nascem um pouco golpe adentro (o offset em Z do Bedrock, onde -Z
 * é o alvo). As faíscas usam a textura das do Bite. No original o tamanho
 * escala com o corpo do alvo; aqui quem escala é o `visual.scale`.
 */

export const BUG_BITE_TEXTURE_PATHS = {
  fang: '/assets/effects/bug-bite/fang.png',
  spark: '/assets/effects/bite/critical_hit.png',
}

// O offset em Z do Bedrock (-Z = alvo), invertido: golpe adentro.
const IMPACT_OFFSET = [0, 0, 0.25]

// O gradiente ARGB das presas: cor e alfa nos mesmos pontos.
const FANG_TINT = compileGradient([
  { at: 0, color: '#ff4733' },
  { at: 0.2, color: '#ff5d4b' },
  { at: 0.5, color: '#ffa951' },
  { at: 0.7, color: '#ffa951' },
  { at: 1, color: '#ffdf6c' },
])
const FANG_ALPHA = [
  [0, 0x46 / 255],
  [0.2, 0xdf / 255],
  [0.5, 1],
  [0.7, 1],
  [1, 0x46 / 255],
]

const SPARK_TINT = compileGradient([
  { at: 0, color: '#ffa951' },
  { at: 0.2, color: '#ff5d4b' },
  { at: 0.5, color: '#ff5d4b' },
  { at: 0.8, color: '#ff4733' },
  { at: 1, color: '#ff4733' },
])
const SPARK_ALPHA = [
  [0, 0x46 / 255],
  [0.2, 1],
  [0.5, 0xdf / 255],
  [0.8, 0xbf / 255],
  [1, 0x46 / 255],
]
// `variable.bitespark`: a faísca cresce, fica e encolhe (nós por vida).
const SPARK_SIZE = [0, 0.87, 1, 0.5, 0]
// Quando as faíscas saem: o evento `llHitspark` na vida das presas.
const SPARK_AT = 0.27

// `math.random(a, b)` com uma random da partícula.
const between = (r, a, b) => a + r * (b - a)

export const BUG_BITE_EMITTERS = [
  // leechlife_target.particle.json — uma mordida, o flipbook inteiro.
  {
    id: 'fang',
    texture: 'fang',
    strip: 6,
    vertical: true,
    frames: { first: 0, count: 6, fps: 12 },
    blending: 'normal',
    start: 0,
    burst: 1,
    anchor: 'impact',
    offset: () => IMPACT_OFFSET,
    direction: () => [0, 0, 1],
    speed: () => 0,
    accel: () => [0, 0, 0],
    drag: () => 0,
    lifetime: () => 0.65,
    size: () => 1,
    spin: false,
    tint: FANG_TINT,
    alpha: (t) => piecewise(FANG_ALPHA, t),
  },
  // leechlife_targetspark.particle.json — faíscas de um ponto, pra fora.
  {
    id: 'sparks',
    texture: 'spark',
    strip: 1,
    frames: { first: 0, count: 1, fps: 1 },
    blending: 'normal',
    start: SPARK_AT,
    burst: 12,
    anchor: 'impact',
    offset: () => IMPACT_OFFSET,
    direction: (ctx, rnd) => [rnd[0] - 0.5, rnd[1] - 0.5, rnd[2] - 0.5],
    speed: (ctx, rnd) => between(rnd[3], 1.75, 4.55) * 3.5,
    accel: () => [0, 0, 0],
    drag: () => 5,
    lifetime: () => 0.4,
    size: (t) => 0.07 * sampleCurve(SPARK_SIZE, t),
    spin: false,
    tint: SPARK_TINT,
    alpha: (t) => piecewise(SPARK_ALPHA, t),
  },
]
