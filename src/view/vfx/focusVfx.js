import { compileGradient, sampleCurve } from './particleSimulation'
import { STATUP_EMITTERS, STATUP_TEXTURE_PATHS } from './statupVfx'

/**
 * Focus Energy em partículas (docs/features/061-revisao-das-skills.md,
 * Rattata). O Cobblemon não tem o golpe:
 *
 * - `FOCUS_ENERGY_EMITTERS` (no uso, nos pés): o "atributo subiu" do Cobblemon
 *   (`statupVfx.js`, as orbes em espiral e os riscos do chão) avermelhado —
 *   a energia se concentrando.
 * - `FOCUS_BODY_EMITTERS` (no corpo, enquanto estiver Focado —
 *   `StatusConditionEffectsView`): faíscas vermelho-alaranjadas subindo de
 *   dentro do corpo, no tamanho dele.
 */

export const FOCUS_TEXTURE_PATHS = {
  ...STATUP_TEXTURE_PATHS,
  spark: '/assets/effects/string-shot/generic.png',
}

// A cor que multiplica a textura laranja do "atributo subiu": vermelho.
const FOCUS_TINT = compileGradient([
  { at: 0, color: '#ff9a8a' },
  { at: 1, color: '#ff4a3d' },
])

export const FOCUS_ENERGY_EMITTERS = STATUP_EMITTERS.map((spec) => ({
  ...spec,
  tint: FOCUS_TINT,
}))

// Faíscas: do amarelo-alaranjado ao vermelho apagando.
const SPARK_TINT = compileGradient([
  { at: 0, color: '#ffd27a' },
  { at: 0.5, color: '#ff7a3d' },
  { at: 1, color: '#c8301f' },
])
const SPARK_SIZE = [0.4, 1, 0.8, 0]

// Corpo de quem não informa o tamanho (m) e a largura em que as faíscas têm o
// tamanho escrito: elas crescem na proporção da largura do corpo.
const DEFAULT_BODY = { width: 0.6, length: 0.6, height: 0.65 }
const REFERENCE_WIDTH = 0.6
const bodyOf = (body) => body ?? DEFAULT_BODY

// Faíscas por segundo e tamanho delas (m, no corpo de referência).
const SPARK_RATE = 10
const SPARK_SCALE = 0.07

export const FOCUS_BODY_EMITTERS = [
  {
    id: 'sparks',
    texture: 'spark',
    strip: 8,
    frames: { first: 7, count: 8, step: -1, stretch: true },
    blending: 'additive',
    start: 0,
    continuous: true,
    rate: () => SPARK_RATE,
    anchor: 'impact',
    // um ponto qualquer dentro do corpo (o sistema nasce nos pés)
    offset: (ctx, rnd) => {
      const { width, length, height } = bodyOf(ctx.body)
      return [
        ((rnd[0] - 0.5) * width) / ctx.scale,
        ((0.1 + rnd[1] * 0.7) * height) / ctx.scale,
        ((rnd[2] - 0.5) * length) / ctx.scale,
      ]
    },
    direction: (ctx, rnd) => [(rnd[3] - 0.5) * 0.4, 1, (rnd[6] - 0.5) * 0.4],
    speed: (ctx, rnd) => 0.5 + rnd[7] * 0.5,
    accel: () => [0, 0.8, 0],
    drag: () => 2,
    lifetime: (ctx, rnd) => 0.5 + rnd[5] * 0.3,
    size: (t, rnd, body) =>
      SPARK_SCALE *
      sampleCurve(SPARK_SIZE, t) *
      (bodyOf(body).width / REFERENCE_WIDTH),
    spin: true,
    tint: SPARK_TINT,
  },
]
