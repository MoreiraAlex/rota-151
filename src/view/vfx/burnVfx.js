import { sampleCurve } from './particleSimulation'
import {
  CLOUD_FUN,
  CLOUD_TINT,
  FIRE_TEXTURE_PATHS,
  LINGER_TINT,
} from './fireParticleKit'

/**
 * Fogo da QUEIMADURA (docs/features/039-tipos-e-combate-classico.md, Parte 4):
 * enquanto a criatura está queimada, chamas pequenas e brasas sobem do corpo
 * dela. Reaproveita as texturas e as cores do fogo do Ember
 * (`fireParticleKit.js`) — sem asset novo.
 *
 *   - `flames` — contínuo: chamas (a nuvem de fogo do Ember) espalhadas pelo
 *     corpo, subindo
 *   - `embers` — contínuo: brasas soltas subindo (as do alvo do Ember)
 *
 * Roda em espaço do MUNDO com o quadro nos pés da criatura (`system.setFrame`,
 * mesmo esquema do dash e da carga); `ctx.radius` é o raio do corpo e
 * `ctx.height` a altura, então o fogo cobre a criatura de qualquer tamanho.
 * Os valores são pra ajustar vendo em jogo.
 */
export const BURN_TEXTURE_PATHS = FIRE_TEXTURE_PATHS

// Um ponto qualquer DENTRO do corpo (offset é multiplicado pela escala; as
// medidas do corpo, em metros, entram já divididas por ela).
const insideBody = (low, high) => (ctx, rnd) => [
  ((rnd[0] - 0.5) * 2 * ctx.radius) / ctx.scale,
  ((low + rnd[1] * (high - low)) * ctx.height) / ctx.scale,
  ((rnd[2] - 0.5) * 2 * ctx.radius) / ctx.scale,
]

export const BURN_EMITTERS = [
  {
    id: 'flames',
    texture: 'cloud',
    strip: 10,
    frames: { first: 1, count: 9, fps: 16 },
    blending: 'normal',
    start: 0,
    continuous: true,
    rate: () => 14,
    anchor: 'impact',
    offset: insideBody(0.1, 0.7),
    direction: (ctx, rnd) => [(rnd[3] - 0.5) * 0.3, 1, (rnd[4] - 0.5) * 0.3],
    speed: (ctx, rnd) => 0.6 + rnd[5] * 0.4,
    accel: () => [0, 1.2, 0],
    drag: () => 2,
    lifetime: (ctx, rnd) => 0.5 + rnd[6] * 0.25,
    size: (t, rnd) => (0.22 + rnd[3] * 0.08) * sampleCurve(CLOUD_FUN, t),
    spin: true,
    tint: CLOUD_TINT,
  },
  {
    id: 'embers',
    texture: 'ember',
    strip: 5,
    frames: { first: 0, count: 5, fps: 20 },
    blending: 'additive',
    start: 0,
    continuous: true,
    rate: () => 8,
    anchor: 'impact',
    offset: insideBody(0.2, 0.9),
    direction: (ctx, rnd) => [(rnd[3] - 0.5) * 0.6, 1, (rnd[4] - 0.5) * 0.6],
    speed: (ctx, rnd) => 0.8 + rnd[5] * 0.6,
    accel: () => [0, 1.5, 0],
    drag: () => 1.5,
    lifetime: () => 0.7,
    size: () => 0.07,
    spin: false,
    tint: LINGER_TINT,
  },
]
