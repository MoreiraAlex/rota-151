import { compileGradient, sampleCurve } from './particleSimulation'

/**
 * Razor Leaf em partículas (ver docs/features/061-revisao-das-skills.md,
 * Parte 2). Tradução manual do Cobblemon (`.exemple/Coblemon/assets/cobblemon/
 * bedrock/particles/moves/razorleaf/`): folhas girando que sobem em volta de
 * quem lança, são disparadas no alvo e estouram em lascas de folha.
 *
 * O golpe é canalizado em cone, então o visual vem em três partes, cada uma
 * na fase dela:
 *
 *   - `RAZOR_LEAF_CHARGE_EMITTERS` (`visual.chargeGroup`, `'razor-leaf-charge'`,
 *     do disparo ao `effectAt`, quadro nos pés): folhas subindo e se abrindo
 *     em volta do corpo — a primeira metade do `razorleaf_actor`.
 *   - `RAZOR_LEAF_VOLLEY_EMITTERS` (`visual.channelGroup`, `'razor-leaf'`, do
 *     `effectAt` até o canal acabar, quadro na origem do golpe, +Z = direção):
 *     a rajada de folhas cortando o cone até o fim dele — a segunda metade do
 *     `razorleaf_actor`, abrindo até o `radius` do golpe.
 *   - `RAZOR_LEAF_HIT_EMITTERS` (`visual.channelHitGroup`, `'razor-leaf-hit'`,
 *     a cada tick, na frente de cada alvo atingido): os cortes
 *     (`razorleaf_target`) e as lascas de folha voando (`razorleaf_targetexcess`).
 *
 * Diferenças pro original: lá as folhas pairam meia vida antes de partir; aqui
 * a rajada começa no `effectAt`, junto com o primeiro tick de dano (nada do
 * golpe espera pra chegar no impacto). O motor não tem evento por partícula,
 * então as lascas são um emissor próprio no mesmo instante dos cortes. As
 * folhas giram pelo flipbook (os quadros da textura são a folha rodando).
 * Velocidades dos estouros multiplicadas por `BURST_SPEED` (as criaturas daqui
 * são menores que as do Minecraft). Sem colisão.
 */

export const RAZOR_LEAF_TEXTURE_PATHS = {
  razorLeaf: '/assets/effects/leaf/razorleaf.png',
  miniHit: '/assets/effects/leaf/minihit.png',
}

// Encolhe as velocidades dos estouros (valor de partida, ajustar no lab).
const BURST_SPEED = 0.5
// Tempo de voo de uma folha da origem até o fim do cone.
const VOLLEY_FLIGHT = 0.3

// `variable.leafrise`/`leafarc` do `razorleaf_actor`.
const LEAF_RISE = [0, 0.65, 0.9, 0.98, 1, 1, 1]
const LEAF_ARC = [0, 0.57, 0.86, 0.96, 1, 1, 0.96, 0.85, 0.7, 0.5]
// `variable.leafsize` do `razorleaf_targetexcess`.
const SCRAP_SIZE = [0, 1, 1, 0.66, 0.33, 0]

const NO_TINT = compileGradient([{ at: 0, color: '#ffffff' }])
const CUT_TINT = compileGradient([
  { at: 0, color: '#ffffff' },
  { at: 1, color: '#b3c6a1' },
])

// A folha da textura: 8 quadros empilhados, ela girando.
const LEAF = {
  texture: 'razorLeaf',
  strip: 8,
  vertical: true,
  frames: { first: 0, count: 8, fps: 24 },
  blending: 'normal',
  tint: NO_TINT,
}

export const RAZOR_LEAF_CHARGE_EMITTERS = [
  // razorleaf_actor (1ª metade) — folhas nascendo no corpo, subindo e se
  // abrindo pros lados até a altura das costas.
  {
    ...LEAF,
    id: 'rise',
    start: 0,
    continuous: true,
    rate: () => 35,
    anchor: 'impact',
    path: (age, particle) => {
      const t = Math.min(age / particle.life, 1)
      const [r0, r1, r2] = particle.rnd
      const rise = sampleCurve(LEAF_RISE, t)
      const height = particle.emitter.height
      return [
        (r0 - 0.5) * 1.2 * rise,
        height * (0.5 + 0.6 * r1 * rise) + sampleCurve(LEAF_ARC, t) * 0.2,
        (r2 - 0.5) * 0.9 * rise,
      ]
    },
    lifetime: () => 0.4,
    size: () => 0.2,
    spin: true,
  },
]

export const RAZOR_LEAF_VOLLEY_EMITTERS = [
  // razorleaf_actor (2ª metade) — folhas disparadas da origem até o fim do
  // cone, abrindo até o `radius` dele, num arco leve.
  {
    ...LEAF,
    id: 'volley',
    start: 0,
    continuous: true,
    rate: () => 30,
    anchor: 'impact',
    path: (age, particle) => {
      const t = Math.min(age / particle.life, 1)
      const [r0, r1] = particle.rnd
      const { length, radius } = particle.emitter
      return [
        (r0 - 0.5) * 2 * radius * t,
        (r1 - 0.5) * radius * t + Math.sin(Math.PI * t) * 0.15,
        length * t,
      ]
    },
    lifetime: () => VOLLEY_FLIGHT,
    size: () => 0.2,
    spin: true,
  },
]

export const RAZOR_LEAF_HIT_EMITTERS = [
  // razorleaf_target — cortes rápidos numa casca em volta do ponto atingido.
  {
    id: 'cuts',
    texture: 'miniHit',
    strip: 3,
    rows: 2,
    row: 0,
    frames: { first: 0, count: 3, fps: 16 },
    blending: 'normal',
    start: 0,
    burst: 3,
    anchor: 'impact',
    shellRadius: () => 0.2,
    direction: () => [0, 1, 0],
    speed: () => 0,
    accel: () => [0, 0, 0],
    drag: () => 0,
    lifetime: () => 0.2,
    size: (t, rnd) => 0.275 - rnd[2] * 0.075,
    spin: (rnd) => Math.round(rnd[3]),
    tint: CUT_TINT,
  },
  // razorleaf_targetexcess — lascas de folha saltando do ponto e caindo.
  {
    ...LEAF,
    id: 'scraps',
    frames: { first: 0, count: 8, fps: 10 },
    start: 0,
    burst: 4,
    anchor: 'impact',
    direction: (ctx, rnd) => [rnd[0] - 0.5, 0.25 + rnd[1] * 0.35, rnd[2] - 0.5],
    speed: () => 4 * BURST_SPEED,
    accel: () => [0, -3, 0],
    drag: () => 2,
    lifetime: () => 0.6,
    size: (t) => 0.2 * sampleCurve(SCRAP_SIZE, t),
    spin: true,
  },
]
