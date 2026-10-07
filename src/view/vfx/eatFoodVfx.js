import { compileGradient, sampleCurve } from './particleSimulation'

/**
 * Partículas de comer fruta (docs/features/042-itens-da-beta.md), no mesmo
 * formato de spec de emissor dos golpes (`particleEmitter.js`). Três efeitos:
 *
 * - **Mordida** (`buildBiteEmitters`) — gotas de suco e farelos da fruta
 *   espirrando de onde ela está, caindo com gravidade. Na cor da fruta.
 * - **Respingo** (`buildLandEmitters`) — a fruta derrubada batendo no chão:
 *   gotas baixas, espalhando pros lados.
 * - **Cura** (`buildHealEmitters`) — brilhos verdes subindo em volta de quem
 *   come, enquanto come (contínuo, segue quem come pelo `frame`).
 *
 * Texturas reaproveitadas de outros efeitos: as gotas do Water Gun, o orbe
 * que esvazia e o brilho do Leech Seed. Os números de partida (quantidade,
 * taxa, escala) vêm de `GAME_CONFIG.FEEDBACK.EAT_FOOD`; os daqui são a
 * forma de cada partícula.
 */

export const EAT_FOOD_TEXTURE_PATHS = {
  drop: '/assets/effects/water-gun/splash.png',
  crumb: '/assets/effects/leech-seed/xsfadeorb.png',
  sparkle: '/assets/effects/leech-seed/sparkle.png',
}

// Gravidade das gotas e farelos (m/s²) — mais leve que a do jogo, pra o
// espirro durar o suficiente pra ser visto.
const PARTICLE_GRAVITY = -7
// A partícula nasce cheia e some encolhendo (nós por vida).
const SHRINK = [1, 1, 0.8, 0]
// Brilho de cura: cresce, segura e some.
const SPARKLE_SIZE = [0, 1, 1, 0.6, 0]
const SPARKLE_TINT = compileGradient([
  { at: 0, color: '#e9ffd9' },
  { at: 1, color: '#46d36b' },
])

/** Gradiente do suco/farelo: a cor da fruta, escurecendo no fim. */
export function berryTint(color) {
  return compileGradient([
    { at: 0, color },
    { at: 1, color: darken(color, 0.45) },
  ])
}

/**
 * Mordida: `juice` gotas e `crumbs` farelos, na cor `color`. As gotas saem
 * mais rápido e pra cima; os farelos, mais devagar, quase só caindo.
 */
export function buildBiteEmitters({ color, juice = 5, crumbs = 3 }) {
  const tint = berryTint(color)
  return [
    {
      id: 'juice',
      texture: 'drop',
      strip: 4,
      frames: { first: 0, count: 4, stretch: true },
      blending: 'normal',
      start: 0,
      burst: juice,
      anchor: 'impact',
      direction: (ctx, rnd) => [rnd[0] * 2 - 1, 0.6 + rnd[1], rnd[2] * 2 - 1],
      speed: (ctx, rnd) => 0.9 + rnd[3] * 0.9,
      accel: () => [0, PARTICLE_GRAVITY, 0],
      drag: () => 0.8,
      lifetime: (ctx, rnd) => 0.35 + rnd[4] * 0.3,
      size: (t, rnd) => (0.035 + rnd[5] * 0.025) * sampleCurve(SHRINK, t),
      spin: true,
      tint,
    },
    {
      id: 'crumb',
      texture: 'crumb',
      strip: 9,
      frames: { first: 0, count: 9, stretch: true },
      blending: 'normal',
      start: 0,
      burst: crumbs,
      anchor: 'impact',
      direction: (ctx, rnd) => [
        rnd[0] * 2 - 1,
        0.3 + rnd[1] * 0.5,
        rnd[2] * 2 - 1,
      ],
      speed: (ctx, rnd) => 0.4 + rnd[3] * 0.5,
      accel: () => [0, PARTICLE_GRAVITY, 0],
      drag: () => 0.5,
      lifetime: (ctx, rnd) => 0.5 + rnd[4] * 0.35,
      size: (t, rnd) => (0.03 + rnd[5] * 0.02) * sampleCurve(SHRINK, t),
      spin: true,
      tint,
    },
  ]
}

/** Respingo da fruta caída batendo no chão: `count` gotas baixas. */
export function buildLandEmitters({ color, count = 4 }) {
  return [
    {
      id: 'splash',
      texture: 'drop',
      strip: 4,
      frames: { first: 0, count: 4, stretch: true },
      blending: 'normal',
      start: 0,
      burst: count,
      anchor: 'impact',
      offset: () => [0, 0.02, 0],
      direction: (ctx, rnd) => [
        rnd[0] * 2 - 1,
        0.35 + rnd[1] * 0.4,
        rnd[2] * 2 - 1,
      ],
      speed: (ctx, rnd) => 0.7 + rnd[3] * 0.7,
      accel: () => [0, PARTICLE_GRAVITY, 0],
      drag: () => 1,
      lifetime: (ctx, rnd) => 0.3 + rnd[4] * 0.25,
      size: (t, rnd) => (0.03 + rnd[5] * 0.02) * sampleCurve(SHRINK, t),
      spin: true,
      tint: berryTint(color),
    },
  ]
}

/**
 * Cura enquanto come: brilhos subindo em volta do corpo, `rate` por segundo,
 * até `endEmission()`. O `frame` (`setFrame`) põe a origem nos pés de quem
 * come; `height` é a altura do corpo (os brilhos nascem ao longo dela).
 */
export function buildHealEmitters({ rate = 6 }) {
  return [
    {
      id: 'heal',
      texture: 'sparkle',
      strip: 2,
      vertical: true,
      frames: { first: 0, count: 2, fps: 10, loop: true },
      blending: 'additive',
      start: 0,
      continuous: true,
      rate: () => rate,
      anchor: 'impact',
      offset: (ctx, rnd) => {
        const angle = rnd[0] * Math.PI * 2
        const radius = 0.25 + rnd[1] * 0.2
        return [
          Math.cos(angle) * radius,
          (ctx.height || 0.6) * (0.15 + rnd[2] * 0.7),
          Math.sin(angle) * radius,
        ]
      },
      direction: () => [0, 1, 0],
      speed: (ctx, rnd) => 0.35 + rnd[3] * 0.3,
      accel: () => [0, 0.2, 0],
      drag: () => 0.6,
      lifetime: (ctx, rnd) => 0.8 + rnd[4] * 0.4,
      size: (t, rnd) => (0.07 + rnd[5] * 0.04) * sampleCurve(SPARKLE_SIZE, t),
      spin: false,
      tint: SPARKLE_TINT,
    },
  ]
}

/** `#rrggbb` escurecido por `amount` (0..1). */
function darken(hex, amount) {
  const value = hex.replace('#', '')
  const channel = (i) =>
    Math.round(parseInt(value.slice(i, i + 2), 16) * (1 - amount))
      .toString(16)
      .padStart(2, '0')
  return `#${channel(0)}${channel(2)}${channel(4)}`
}
