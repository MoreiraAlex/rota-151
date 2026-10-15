import { GAME_CONFIG } from '@/core/gameConfig'
import { compileGradient, sampleCurve } from './particleSimulation'

/**
 * Respingo de quem pula, cai ou dá dash na água (docs/features/057-lagos-e-
 * rios.md) — o lugar da poeira (`jumpDustVfx.js`) quando os pés estão na
 * água. Só água, sem fumaça: gotas (as do Water Gun) saltando para cima e
 * para os lados e caindo — uma coroa (`crown`, mais altas, perto do meio) e
 * as que espirram longe (`spray`, mais baixas). O anel na superfície vem à
 * parte (`addFootRipple`, quem solta o respingo). Números em
 * `GAME_CONFIG.FEEDBACK.WATER_SPLASH`.
 *
 * Nascem no MUNDO, na superfície da água sob os pés (`anchor: 'impact'`).
 */

export const WATER_SPLASH_TEXTURE_PATHS = {
  drop: '/assets/effects/water-gun/splash.png',
}

// Gravidade das gotas (m/s²) — mais leve que a do jogo, pro respingo durar
// o suficiente pra ser visto.
const DROP_GRAVITY = -10
const DROP_TINT = compileGradient([
  { at: 0, color: '#ffffff' },
  { at: 1, color: '#a8dcf2' },
])
// A gota nasce cheia e some encolhendo (nós por vida).
const DROP_SHRINK = [1, 1, 0.8, 0]

const drops = ({ id, count, up, out, size, speed, lifetime }) => ({
  id,
  texture: 'drop',
  strip: 4,
  frames: { first: 0, count: 4, stretch: true },
  blending: 'normal',
  start: 0,
  burst: count,
  anchor: 'impact',
  offset: (ctx, rnd) => {
    const angle = rnd[4] * Math.PI * 2
    const r = 0.12 * rnd[5]
    return [Math.cos(angle) * r, 0.02, Math.sin(angle) * r]
  },
  direction: (ctx, rnd) => {
    const angle = rnd[4] * Math.PI * 2
    return [
      Math.cos(angle) * out,
      up * (0.7 + rnd[1] * 0.6),
      Math.sin(angle) * out,
    ]
  },
  speed: (ctx, rnd) => speed * (0.75 + rnd[3] * 0.5),
  accel: () => [0, DROP_GRAVITY, 0],
  drag: () => 0.4,
  lifetime: (ctx, rnd) => lifetime * (0.8 + rnd[6] * 0.4),
  size: (t, rnd) => size * (0.6 + rnd[7] * 0.8) * sampleCurve(DROP_SHRINK, t),
  spin: true,
  tint: DROP_TINT,
})

/**
 * O respingo. `count`: as nuvens de poeira que sairiam ali (a mesma conta
 * do pulo e do dash — vira `DROPS_PER_PUFF` gotas cada); `speed` e `size`
 * (a força da poeira) aumentam o respingo junto.
 */
export function buildWaterSplashEmitters({
  count = 4,
  speed = 1.6,
  size = 0.45,
} = {}) {
  const { DROPS_PER_PUFF, DROP_SIZE, DROP_SPEED } =
    GAME_CONFIG.FEEDBACK.WATER_SPLASH
  // A força da poeira (perto de 1 numa decolagem) escala o respingo.
  const strength = (speed / 1.8 + size / 0.475) / 2
  const total = Math.max(1, Math.round(count * DROPS_PER_PUFF))
  return [
    drops({
      id: 'crown',
      count: Math.ceil(total * 0.6),
      up: 2.2,
      out: 0.6,
      size: DROP_SIZE * strength,
      speed: DROP_SPEED * strength,
      lifetime: 0.6,
    }),
    drops({
      id: 'spray',
      count: Math.ceil(total * 0.4),
      up: 0.8,
      out: 1,
      size: DROP_SIZE * 0.7 * strength,
      speed: DROP_SPEED * 1.2 * strength,
      lifetime: 0.45,
    }),
  ]
}
