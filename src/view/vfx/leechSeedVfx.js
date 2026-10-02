import { compileGradient, sampleCurve } from './particleSimulation'

/**
 * Leech Seed em partículas (ver docs/features/033-skills-de-combate-e-vfx.md,
 * Parte 9). Tradução manual do Cobblemon (`.exemple/Coblemon/assets/cobblemon/
 * bedrock/particles/moves/leechseed/` e `.../megadrain/megadrain_actorhit`):
 *
 * Lançamento (`LEECH_SEED_EMITTERS`, grupo `'leech-seed'`, o `AttackEffect`
 * nasce no alvo, quem lançou em (0, 0, -length)):
 *
 *   - `seeds`    — sementes voando em arco até o alvo
 *   - `burst`    — orbes verdes estourando no alvo (o `leechseed_target`)
 *   - `sprout`   — um broto nascendo no alvo
 *   - `sparkle`  — brilhos em volta (o `leechseed_targetsparkle`)
 *
 * Cada drenagem (`LEECH_DRAIN_EMITTERS`, grupo `'leech-drain'`, nasce no alvo,
 * quem plantou em (0, 0, -length)):
 *
 *   - `hit`      — estouro de orbes no alvo (o `megadrain_actorhit`, o mesmo
 *                      que o Cobblemon usa no dano do Leech Seed)
 *   - `sprouts`  — brotos em volta do alvo (o `leechseed_sproutpassive`)
 *   - `stream`   — orbes em espiral indo do alvo até quem plantou (o "puxar"
 *                      do Giga Drain — escolha do usuário; o Cobblemon não tem)
 *
 * `LEECH_DRAIN_SOLO_EMITTERS` (grupo `'leech-drain-solo'`): sem quem plantou
 * (recolhido) não há pra onde puxar — só o estouro e os brotos.
 *
 * Diferenças pro original: as sementes VOAM, em vez de nascer no
 * alvo como os golpes de dano (regra da Parte 2) — o Leech Seed não causa dano
 * no `effectAt`, a 1ª drenagem só vem um `interval` depois, então o voo não atrasa nada;
 * o som do alvo espera o pouso (`attackSound.js`). Velocidades de estouro
 * multiplicadas por `BURST_SPEED` (as criaturas daqui são menores que as do
 * Minecraft). O gradiente original apaga pelo ALFA; aqui fica a cor e o fade do
 * fim da vida. Sem colisão.
 */

export const LEECH_SEED_TEXTURE_PATHS = {
  seed: '/assets/effects/leech-seed/xsseed.png',
  orbLite: '/assets/effects/leech-seed/xsfadeorblite.png',
  orb: '/assets/effects/leech-seed/xsfadeorb.png',
  sprout: '/assets/effects/leech-seed/sprout.png',
  sparkle: '/assets/effects/leech-seed/sparkle.png',
  drainOrb: '/assets/effects/absorb/gigadrain_orb.png',
}

// Quando a semente pousa (o fim do voo) — o estouro e o broto começam aí.
export const SEED_FLIGHT = 0.35
// Encolhe as velocidades dos estouros (valor de partida, ajustar em jogo).
const BURST_SPEED = 0.5

// `variable.seedarc` (a altura do arco ao longo do voo).
const SEED_ARC = [0, 0.52, 0.84, 0.96, 1, 0.98, 0.87, 0.64, 0]
// `variable.crtrailsize` dos brilhos.
const SPARKLE_SIZE = [0, 0.67, 1, 1, 0.9, 0.5, 0]
// `variable.drainopen`/`gdsize` do Giga Drain, pros orbes que viajam.
const DRAIN_OPEN = [0.35, 0.8, 0.98, 1, 1, 1, 1, 0.98, 0.9, 0.65, 0.01]
const DRAIN_ORB_SIZE = [0, 1, 1, 1, 0.9, 0.58, 0.25]

const NO_TINT = compileGradient([{ at: 0, color: '#ffffff' }])
const BURST_TINT = compileGradient([
  { at: 0, color: '#ceffab' },
  { at: 0.7, color: '#4bb538' },
])
const SPARKLE_TINT = compileGradient([
  { at: 0, color: '#a5ff97' },
  { at: 0.23, color: '#e6ffb7' },
  { at: 0.75, color: '#89ffb3' },
  { at: 1, color: '#00eb84' },
])
const HIT_TINT = compileGradient([
  { at: 0, color: '#51c400' },
  { at: 0.24, color: '#d8ff96' },
  { at: 0.7, color: '#a6f700' },
  { at: 1, color: '#65d000' },
])

const deg = (degrees) => (degrees * Math.PI) / 180
const between = (rnd, min, max) => min + rnd * (max - min)

// Ponto na superfície de uma esfera unitária, sorteado pelos randoms.
function unitSphere(a, b) {
  const z = a * 2 - 1
  const angle = b * Math.PI * 2
  const ring = Math.sqrt(1 - z * z)
  return [Math.cos(angle) * ring, z, Math.sin(angle) * ring]
}

// Broto (`leechseed_sprout`/`sproutpassive`): 6 quadros lado a lado, 0.4 m.
function sproutSpec(id, overrides) {
  return {
    id,
    texture: 'sprout',
    strip: 6,
    frames: { first: 0, count: 6, fps: 11.5 },
    blending: 'normal',
    anchor: 'impact',
    direction: () => [0, 1, 0],
    speed: () => 0,
    accel: () => [0, 0, 0],
    drag: () => 0,
    lifetime: () => 0.5,
    size: () => 0.4,
    spin: true,
    tint: NO_TINT,
    ...overrides,
  }
}

export const LEECH_SEED_EMITTERS = [
  // leechseed_actor — sementes da boca até o alvo, num arco (`seedarc`),
  // espalhando um pouco de lado e na altura na chegada.
  {
    id: 'seeds',
    texture: 'seed',
    strip: 8,
    frames: { first: 0, count: 8, fps: 16, loop: true },
    blending: 'normal',
    start: 0,
    duration: 0.3,
    rate: () => 13,
    anchor: 'origin',
    path: (age, particle) => {
      const t = Math.min(age / particle.life, 1)
      const [r0, r1] = particle.rnd
      return [
        (r0 - 0.5) * 0.5 * t,
        (r1 - 0.5) * 0.5 * t + sampleCurve(SEED_ARC, t) * 0.5,
        particle.emitter.length * t,
      ]
    },
    lifetime: () => SEED_FLIGHT,
    size: () => 0.125,
    spin: true,
    tint: NO_TINT,
  },
  // leechseed_target — 4 orbes estourando no alvo quando a semente pousa.
  {
    id: 'burst',
    texture: 'orbLite',
    strip: 9,
    frames: { first: 0, count: 9, fps: 18 },
    blending: 'normal',
    start: SEED_FLIGHT,
    burst: 4,
    anchor: 'impact',
    direction: (ctx, rnd) => {
      const angle = rnd[4] * Math.PI * 2
      return [
        Math.sin(angle) * 0.75,
        (rnd[1] - 0.25) * 2,
        Math.cos(angle) * 0.75,
      ]
    },
    speed: (ctx, rnd) => between(rnd[5], 3.51, 4.51) * 0.85 * BURST_SPEED,
    accel: () => [0, -4, 0],
    drag: () => 3,
    lifetime: () => 0.5,
    size: () => 0.125,
    spin: false,
    tint: BURST_TINT,
  },
  // leechseed_sprout — o broto que nasce onde a semente pousou.
  sproutSpec('sprout', { start: SEED_FLIGHT, burst: 1 }),
  // leechseed_targetsparkle — brilhos subindo de uma casca de 0.5 m.
  {
    id: 'sparkle',
    texture: 'sparkle',
    strip: 2,
    vertical: true,
    frames: { first: 0, count: 2, fps: 16, loop: true },
    blending: 'additive',
    start: SEED_FLIGHT,
    duration: 0.5,
    rate: () => 5,
    anchor: 'impact',
    shellRadius: () => 0.5,
    direction: (ctx, rnd) => [
      (rnd[0] - 0.5) * 0.2,
      (rnd[1] + 0.25) * 0.33,
      (rnd[2] - 0.5) * 0.2,
    ],
    speed: (ctx, rnd) => 0.45 - rnd[3] * 0.05,
    accel: () => [0, 0, 0],
    drag: (ctx, rnd) => rnd[3] + 0.1,
    lifetime: (ctx, rnd) => 0.95 + rnd[3] * 0.1,
    size: (t, rnd) => (0.1 - rnd[3] * 0.04) * sampleCurve(SPARKLE_SIZE, t),
    spin: false,
    tint: SPARKLE_TINT,
  },
]

// megadrain_actorhit — 20 orbes estourando pra todo lado no alvo.
const DRAIN_HIT = {
  id: 'hit',
  texture: 'orb',
  strip: 9,
  frames: { first: 0, count: 9, fps: 12 },
  blending: 'additive',
  start: 0,
  burst: 20,
  anchor: 'impact',
  direction: (ctx, rnd) => unitSphere(rnd[4], rnd[5]),
  speed: (ctx, rnd) => between(rnd[6], 3.55, 6.05) * 1.2 * BURST_SPEED,
  accel: (ctx, rnd) => [
    (rnd[0] - 0.5) * 6.5 * BURST_SPEED,
    (rnd[1] - 0.5) * 6.5 * BURST_SPEED,
    (rnd[2] - 0.5) * 6.5 * BURST_SPEED,
  ],
  drag: () => 3.25,
  lifetime: (ctx, rnd) => 1.05 + rnd[1] * 0.35,
  size: (t, rnd) => 0.1 - rnd[0] * 0.05,
  spin: false,
  tint: HIT_TINT,
}

// leechseed_sproutpassive — brotos num anel de 0.45 m em volta do alvo.
const DRAIN_SPROUTS = sproutSpec('sprouts', {
  start: 0,
  duration: 0.5,
  rate: () => 6,
  offset: (ctx) => [
    Math.sin(deg(ctx.age * 787)) * 0.45,
    0.2,
    Math.cos(deg(ctx.age * 787)) * 0.45,
  ],
})

// Orbes em espiral do alvo (0, 0, 0) até quem plantou (0, 0, -length) — o
// giro do `gigadrain_actor`, num raio menor, viajando no eixo do golpe.
const DRAIN_STREAM = {
  id: 'stream',
  texture: 'drainOrb',
  strip: 9,
  rows: 2,
  row: 1,
  frames: { first: 0, count: 9, fps: 12 },
  blending: 'normal',
  start: 0,
  duration: 0.5,
  rate: () => 14,
  anchor: 'impact',
  path: (age, particle) => {
    const t = Math.min(age / particle.life, 1)
    const radius = 0.25 * (1 - t) * sampleCurve(DRAIN_OPEN, t)
    const angle = deg(age * 65 + particle.emitter.age * 1523)
    return [
      Math.sin(angle) * radius,
      Math.cos(angle) * radius,
      -particle.emitter.length * t,
    ]
  },
  lifetime: () => 0.7,
  size: (t) => 0.15 * sampleCurve(DRAIN_ORB_SIZE, t),
  spin: false,
  tint: NO_TINT,
}

export const LEECH_DRAIN_EMITTERS = [DRAIN_HIT, DRAIN_SPROUTS, DRAIN_STREAM]
export const LEECH_DRAIN_SOLO_EMITTERS = [DRAIN_HIT, DRAIN_SPROUTS]
