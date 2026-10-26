import { compileGradient, sampleCurve } from './particleSimulation'
import { JUMP_DUST_TEXTURE_PATHS } from './jumpDustVfx'

/**
 * Rapid Spin em partículas — efeito próprio (o Cobblemon não tem o golpe):
 * o ar girando em volta do casco enquanto a criatura roda como pião e a
 * poeira que o giro levanta do chão. É o efeito da AÇÃO
 * (`visual.actionGroup: 'rapid-spin'`, `ContinuousAttackEffectsView.jsx`),
 * preso à criatura, do `effectAt` até o fim da ação; o acerto continua com o
 * impacto do tipo.
 *
 *   - `swirl` — riscos de ar (as linhas do Quick Attack, as mesmas do dash)
 *     dando voltas em volta do corpo, esticados na direção em que andam
 *   - `dust`  — nuvens de poeira saindo dos pés, jogadas pro lado do giro
 *
 * Quadro: origem no centro do corpo, `height` = a altura dele (os pés em
 * `-height/2`). O giro é anti-horário visto de cima, o mesmo sentido do
 * pião do clipe (`waist.rotation.x` positivo). Os tamanhos saem da altura
 * do corpo, então servem pra qualquer espécie. Sem colisão com o chão.
 */

export const RAPID_SPIN_TEXTURE_PATHS = {
  spinLines: '/assets/effects/dash/dashlines.png',
  spinSmoke: JUMP_DUST_TEXTURE_PATHS.smoke,
}

// Voltas por segundo do ar em volta do corpo (mais rápido que o casco).
const SWIRL_TURNS_PER_SECOND = 3
// Raio do giro do ar: fração da altura do corpo, com limites (m).
const SWIRL_RADIUS = { fraction: 0.75, min: 0.3, max: 1.2 }

const LINE_TINT = compileGradient([
  { at: 0.17, color: '#b4feff' },
  { at: 0.5, color: '#ffffff' },
  { at: 0.86, color: '#b7feff' },
])
// O risco nasce curto, estica e some (nós por vida).
const LINE_SQUISH = [0, 1, 1, 0]

const DUST_TINT = compileGradient([
  { at: 0, color: '#d6d0c4' },
  { at: 1, color: '#a39b8b' },
])
// A nuvem nasce pequena, cresce e esvazia (nós por vida).
const DUST_SIZE = [0.5, 1, 1.1, 0.9]

const TWO_PI = Math.PI * 2

const swirlRadius = (height) =>
  Math.min(
    Math.max(height * SWIRL_RADIUS.fraction, SWIRL_RADIUS.min),
    SWIRL_RADIUS.max,
  )

// Ponto no círculo, anti-horário visto de cima (+Y pra cima, +Z pra frente).
const onCircle = (angle, radius) => [
  Math.cos(angle) * radius,
  -Math.sin(angle) * radius,
]

export const RAPID_SPIN_EMITTERS = [
  {
    id: 'swirl',
    texture: 'spinLines',
    strip: 7,
    frames: { first: 0, count: 7, fps: 16 },
    // esticado na direção em que anda (a tangente do giro)
    facing: 'direction',
    blending: 'normal',
    opacity: 0.85,
    start: 0,
    continuous: true,
    rate: () => 90,
    anchor: 'impact',
    // o caminho é contado no espaço do efeito, que a escala multiplica
    path: (age, particle) => {
      const [r0, r1, r2] = particle.rnd
      const height = particle.emitter.height / particle.scale
      const radius = swirlRadius(height) * (0.9 + r1 * 0.25)
      const angle = r0 * TWO_PI + SWIRL_TURNS_PER_SECOND * TWO_PI * age
      const [x, z] = onCircle(angle, radius)
      // da base do casco pra cima, subindo um pouco enquanto gira
      const y = -height / 2 + height * (0.1 + 0.5 * r2) + 0.4 * age
      return [x, y, z]
    },
    lifetime: () => 0.25,
    size: (t) => [0.45 * sampleCurve(LINE_SQUISH, t), 0.05],
    spin: false,
    tint: LINE_TINT,
  },
  {
    id: 'dust',
    texture: 'spinSmoke',
    strip: 12,
    vertical: true,
    frames: { first: 0, count: 12, step: 1, stretch: true },
    blending: 'normal',
    start: 0,
    continuous: true,
    rate: () => 22,
    anchor: 'impact',
    // um ponto sorteado no anel em volta dos pés (`rnd[4]` = o ângulo)
    offset: (ctx, rnd) => {
      const height = ctx.height / ctx.scale
      const [x, z] = onCircle(rnd[4] * TWO_PI, swirlRadius(height) * 0.8)
      return [x, -height / 2 + 0.03, z]
    },
    // jogada pro lado do giro (a tangente) e um pouco pra fora
    direction: (ctx, rnd) => {
      const angle = rnd[4] * TWO_PI
      const [outX, outZ] = onCircle(angle, 1)
      const [tangentX, tangentZ] = onCircle(angle + Math.PI / 2, 1)
      return [tangentX + outX * 0.6, 0.1, tangentZ + outZ * 0.6]
    },
    speed: (ctx, rnd) => 1.4 * (0.7 + rnd[6] * 0.6),
    accel: () => [0, 0.6, 0],
    drag: () => 2.2,
    lifetime: (ctx, rnd) => 0.45 + rnd[8] * 0.3,
    size: (t, rnd) => 0.32 * sampleCurve(DUST_SIZE, t) * (0.8 + rnd[7] * 0.4),
    spin: true,
    tint: DUST_TINT,
  },
]
