import { compileGradient, sampleCurve } from './particleSimulation'

/**
 * Water Gun em partículas (ver docs/features/033-skills-de-combate-e-vfx.md,
 * Parte 10). Tradução manual de `watergun_spray`, `watergun_actor`,
 * `watergun_target` e `watergun_targetfoam` do Cobblemon
 * (`.exemple/Coblemon/assets/cobblemon/bedrock/particles/moves/watergun/`).
 *
 * Espaço local: o `AttackEffect` nasce no alvo (impacto), quem atacou fica em
 * (0, 0, -length), +Z na direção do golpe (o Z do Bedrock é invertido).
 *
 *   0.00  `spray`  — gotas espirrando da boca (0.4 s)
 *   0.00  `jet`    — o jato: gotas da boca até um pouco além do alvo, com uma
 *                    leve ondulação (0.4 s de emissão, 0.675 s de voo cada)
 *   0.00  `splash` — respingo de gotas no alvo
 *   0.00  `foam`   — espuma azul no alvo
 *
 * Diferenças pro original:
 * - impacto único (decisão do usuário): o jato e o borrifo do Cobblemon duram
 *   1.1–1.25 s (um fluxo); aqui 0.4 s, com mais gotas por segundo pra o jato não
 *   ficar ralo; o respingo e a espuma (1 s a 100/s) viram rajadas curtas;
 * - o respingo e a espuma saem no `effectAt` (no Cobblemon, 0.3 s depois,
 *   esperando o jato) — a regra dos golpes de dano (Parte 2): dano e impacto
 *   juntos; o jato ainda leva uma fração de segundo pra se estender, como o
 *   Lança-chamas;
 * - velocidades das gotas multiplicadas por `SPEED` (criaturas menores que as
 *   do Minecraft); sem colisão com o chão; o quadro das gotas soltas é fixo (o
 *   original sorteia entre 2).
 */

export const WATER_GUN_TEXTURE_PATHS = {
  splash: '/assets/effects/water-gun/splash.png',
  foam: '/assets/effects/water-gun/smokeorb.png',
}

const SPEED = 0.5
const EMIT = 0.4
const JET_LIFE = 0.675

// `variable.wpshrink` (borrifo) e `variable.watersize` (jato).
const SPRAY_SHRINK = [1, 0.86, 0]
const JET_SIZE = [1, 1, 1, 1, 1, 1, 1, 0.05]

const NO_TINT = compileGradient([{ at: 0, color: '#ffffff' }])
// `#AARRGGBB` no original: só o RGB entra (o alfa fica com o fade do fim).
const FOAM_TINT = compileGradient([
  { at: 0, color: '#c0fffe' },
  { at: 0.39, color: '#c4ffff' },
  { at: 0.72, color: '#a0ebff' },
  { at: 0.93, color: '#3799ff' },
])

const deg = (degrees) => (degrees * Math.PI) / 180
const between = (rnd, min, max) => min + rnd * (max - min)

// Gota de água: retângulo 3×2 do atlas `splash` (4 quadros lado a lado), que
// cresce com a idade — `0.1 + idade × 0.05` por `0.066 + idade × 0.05`.
function dropSize(life, curve) {
  return (t) => {
    const age = t * life
    const k = curve ? sampleCurve(curve, t) : 1
    return [(0.1 + age * 0.05) * k, (0.066 + age * 0.05) * k]
  }
}

const DROP = {
  texture: 'splash',
  strip: 4,
  blending: 'normal',
  spin: true,
  tint: NO_TINT,
}

// watergun_spray — da boca, espirrando pros lados e pra cima.
const SPRAY = {
  ...DROP,
  id: 'spray',
  frames: { first: 0, count: 1, fps: 1 },
  start: 0,
  duration: EMIT,
  rate: () => 30,
  anchor: 'origin',
  direction: (ctx) => [
    Math.sin(deg(ctx.age * 3280)) * 3,
    1.75 - Math.cos(deg(ctx.age * 2280)) * 2,
    1,
  ],
  speed: (ctx, rnd) => between(rnd[4], 6.25, 9.25) * 0.5 * SPEED,
  accel: () => [0, -6, 0],
  drag: () => 1,
  lifetime: () => 0.3,
  size: dropSize(0.3, SPRAY_SHRINK),
}

// watergun_actor — o jato: da boca até 10% além do alvo, ondulando.
const JET = {
  ...DROP,
  id: 'jet',
  frames: { first: 0, count: 4, fps: 3 },
  start: 0,
  duration: EMIT,
  rate: () => 60,
  anchor: 'origin',
  path: (age, particle) => {
    const t = Math.min(age / particle.life, 1)
    return [
      0,
      Math.sin(deg(age * 340)) * 0.2,
      particle.emitter.length * t * 1.1,
    ]
  },
  lifetime: () => JET_LIFE,
  size: dropSize(JET_LIFE, JET_SIZE),
}

// watergun_target — gotas respingando no alvo, mais pra frente que pra trás.
const SPLASH = {
  ...DROP,
  id: 'splash',
  frames: { first: 0, count: 1, fps: 1 },
  start: 0,
  duration: 0.25,
  rate: () => 100,
  anchor: 'impact',
  direction: (ctx, rnd) => [
    between(rnd[4], -3.01, 3.01),
    between(rnd[5], -0.91, 3.01),
    between(rnd[6], -0.31, 2.99),
  ],
  speed: (ctx, rnd) => between(rnd[7], 5.25, 9.25) * 0.6 * SPEED,
  accel: () => [0, -6, 0],
  drag: () => 2,
  lifetime: () => 0.25,
  size: dropSize(0.25),
}

// watergun_targetfoam — espuma azul se espalhando devagar no alvo.
const FOAM = {
  id: 'foam',
  texture: 'foam',
  strip: 11,
  frames: { first: 0, count: 11, fps: 24 },
  blending: 'normal',
  start: 0,
  duration: 0.3,
  rate: () => 100,
  anchor: 'impact',
  direction: (ctx, rnd) => [
    between(rnd[4], -3.01, 3.01),
    between(rnd[5], -3.01, 3.01),
    between(rnd[6], 0.01, 2.99),
  ],
  speed: (ctx, rnd) => between(rnd[7], 3.25, 9.25) * 0.15,
  accel: () => [0, -0.1, 0.5],
  drag: () => 0,
  lifetime: () => 0.55,
  size: (t) => 0.2 + t * 0.55 * 0.25,
  spin: true,
  tint: FOAM_TINT,
}

/** O tiro único (o `AttackEffect` nasce no alvo): borrifo, jato, respingo, espuma. */
export const WATER_GUN_EMITTERS = [SPRAY, JET, SPLASH, FOAM]

/**
 * O respingo de cada tick do canalizado em feixe (`visual.channelHitGroup`,
 * grupo `'water-gun-hit'`): onde o jato bate agora — no corpo atingido ou no
 * fim da trajetória.
 */
export const WATER_GUN_HIT_EMITTERS = [SPLASH, FOAM]

/**
 * O jato do canalizado em feixe (`visual.channelGroup`, grupo `'water-jet'`,
 * `ContinuousAttackEffectsView.jsx`): roda enquanto o canal durar, no espaço
 * do MUNDO, com o quadro na boca virado pra mira de agora e `length` = até
 * onde o feixe bate agora (atualizados a cada frame). Cada gota sai na
 * direção do momento em que nasceu, então mirar varre o jato num arco. Sem o
 * excesso de 10% do tiro único: o jato termina onde bate.
 */
export const WATER_JET_EMITTERS = [
  { ...SPRAY, anchor: 'impact', continuous: true, duration: undefined },
  {
    ...JET,
    anchor: 'impact',
    continuous: true,
    duration: undefined,
    path: (age, particle) => {
      const t = Math.min(age / particle.life, 1)
      return [0, Math.sin(deg(age * 340)) * 0.2, particle.emitter.length * t]
    },
  },
]
