import { compileGradient } from './particleSimulation'
import { PECK_TEXTURE_PATHS } from './peckVfx'

/**
 * Ataque de Fúria (Fury Attack) em partículas — UMA bicada da rajada; cada
 * acerto do golpe (`core/battle/multiHit.js`) nasce um efeito destes. O
 * Cobblemon não tem o golpe: é o corte e o estouro da bicada do Peck
 * (`peckVfx.js`, do Aerial Ace), mais curtos e com um corte só, pra rajada
 * não virar uma mancha no mesmo ponto:
 *
 *   - `cut`   — um corte rápido, num ângulo sorteado a cada bicada e um
 *     pouco deslocado do contato (as bicadas caem em lugares diferentes)
 *   - `burst` — um punhado de faíscas azuladas saindo do corte
 *
 * Espaço local: impacto em (0, 0, 0), +Z na direção do golpe.
 */

export const FURY_ATTACK_TEXTURE_PATHS = PECK_TEXTURE_PATHS

// Quanto o ponto da bicada pode fugir do contato, pra cada lado (m, ×escala).
const SPREAD = 0.35
// Vida do corte e das faíscas (s): curtas, a próxima bicada vem logo.
const CUT_LIFETIME = 0.18
const BURST_LIFETIME = 0.25

const CUT_TINT = compileGradient([{ at: 0, color: '#cbfffe' }])
const BURST_TINT = compileGradient([
  { at: 0, color: '#d1f5ff' },
  { at: 1, color: '#8bd0ff' },
])

// O mesmo deslocamento pras duas partes de UMA bicada: as randoms da
// partícula mudam entre o corte e as faíscas, então o ponto vem do
// `ctx.seed`, sorteado uma vez por efeito.
const hitOffset = (ctx) => [
  (ctx.seed[0] - 0.5) * 2 * SPREAD,
  (ctx.seed[1] - 0.5) * 2 * SPREAD,
  0,
]

export const FURY_ATTACK_EMITTERS = [
  {
    id: 'cut',
    texture: 'swipe',
    strip: 6,
    vertical: true,
    frames: { first: 0, count: 6, stretch: true },
    facing: 'direction',
    blending: 'normal',
    start: 0,
    burst: 1,
    anchor: 'impact',
    offset: hitOffset,
    // a diagonal do corte gira em volta do eixo do golpe, por bicada
    direction: (ctx) => {
      const angle = ctx.seed[2] * Math.PI * 2
      return [Math.cos(angle), Math.sin(angle), 0.5]
    },
    speed: () => 0.1,
    accel: () => [0, 0, 0],
    drag: () => 25,
    lifetime: () => CUT_LIFETIME,
    size: () => [0.9, 0.45],
    spin: false,
    tint: CUT_TINT,
  },
  {
    id: 'burst',
    texture: 'white',
    strip: 1,
    frames: { first: 0, count: 1, fps: 1 },
    blending: 'normal',
    start: 0,
    burst: 6,
    anchor: 'impact',
    offset: hitOffset,
    direction: (ctx, rnd) => [rnd[0] - 0.5, rnd[1] - 0.5, -rnd[2]],
    speed: (ctx, rnd) => (3 + rnd[3] * 3) * ctx.scale,
    accel: () => [0, -9.8, 0],
    drag: () => 5,
    lifetime: () => BURST_LIFETIME,
    size: (t) => 0.0625 * (1 - t),
    spin: false,
    tint: BURST_TINT,
    tintAt: (t, rnd) => rnd[4],
  },
]
