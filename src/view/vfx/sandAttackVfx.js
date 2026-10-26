import { compileGradient } from './particleSimulation'
import { piecewise } from './biteVfx'

/**
 * Ataque de Areia (Sand Attack) em partículas — tradução manual das
 * definições do Cobblemon (`.exemple/Coblemon/assets/cobblemon/bedrock/
 * particles/moves/sandattack/` e a linha do tempo em `data/cobblemon/
 * action_effects/moves/sandattack.json`). Mesmo contrato de `ctx`/`rnd` de
 * `emberVfx.js`; os grãos usam o flipbook `powder` e a poeira, o `smokeorb`.
 *
 * Dois efeitos:
 *
 * - `SAND_ATTACK_EMITTERS` (o golpe, nasce no impacto): `spray` — a areia
 *   chutada pra frente em arco, caindo (`sandattack_actor`); `dust` — a
 *   poeira fina junto, logo depois (`sandattack_residual`). No original o
 *   jato tem força fixa; aqui ela acompanha a distância até o alvo
 *   (`ctx.length`), pra areia cair nele perto ou longe.
 * - `SAND_ATTACK_TARGET_EMITTERS` (nasce no alvo atingido, quando a areia
 *   chega — a pausa da linha do tempo de lá): `grains` — os grãos estourando
 *   (`sandattack_impact`); `cloud` — a nuvem de poeira na frente dele
 *   (`sandattack_impactresidual`).
 *
 * Espaço local do golpe: impacto em (0, 0, 0), criatura em (0, 0, -length),
 * +Z na direção do golpe — o eixo Z do Bedrock aponta pro lado oposto, então
 * o `z` das direções do atacante foi INVERTIDO na tradução. O efeito do alvo
 * nasce no centro dele, virado como ele (+Z a frente dele).
 */

export const SAND_ATTACK_TEXTURE_PATHS = {
  powder: '/assets/effects/sand-attack/powder.png',
  orb: '/assets/effects/sand-attack/smokeorb.png',
}

// Quanto a areia leva pra chegar ao alvo (s): a pausa da linha do tempo do
// Cobblemon entre o chute e o acerto.
export const SAND_TRAVEL = 0.3
// A distância (m) em que o jato tem a força do original: mais longe, mais
// forte, na proporção.
const REFERENCE_DISTANCE = 3
// O raio do corpo na conta do ponto de saída (`q.entity_radius × 0.7`): o
// efeito não sabe o corpo de quem usa.
const ACTOR_RADIUS = 0.3

// Areia: creme claro escurecendo ao longo da vida.
const SAND_TINT = compileGradient([
  { at: 0, color: '#ffe9c3' },
  { at: 1, color: '#eed18f' },
])
// Poeira: quase transparente (o alfa do gradiente ARGB do original).
const DUST_TINT = compileGradient([
  { at: 0, color: '#fff2d1' },
  { at: 1, color: '#eed18f' },
])
const DUST_ALPHA = [
  [0, 0x20 / 255],
  [1, 0x10 / 255],
]

// `math.random(a, b)` com uma random da partícula.
const between = (r, a, b) => a + r * (b - a)

// Força do jato pela distância até o alvo.
const reach = (ctx) => Math.max(ctx.length, 0.5) / REFERENCE_DISTANCE

// Os grãos e a poeira: o flipbook inteiro, girados em quartos de volta.
const grainBase = {
  texture: 'powder',
  strip: 11,
  frames: { first: 0, count: 11, fps: 14 },
  blending: 'normal',
  spin: true,
  tint: SAND_TINT,
}
const dustBase = {
  texture: 'orb',
  strip: 11,
  frames: { first: 0, count: 11, fps: 20 },
  blending: 'normal',
  spin: true,
  tint: DUST_TINT,
  alpha: (t) => piecewise(DUST_ALPHA, t),
}

// O ponto de saída: um pouco à frente do corpo, rente à origem.
const actorOffset = () => [0, 0.05, ACTOR_RADIUS * 0.7]

export const SAND_ATTACK_EMITTERS = [
  // sandattack_actor.particle.json — a areia de uma vez, pra frente e pra
  // cima, caindo com a gravidade.
  {
    ...grainBase,
    id: 'spray',
    start: 0,
    burst: 30,
    anchor: 'origin',
    offset: actorOffset,
    direction: (ctx, rnd) => [
      between(rnd[0], -0.81, 0.81),
      between(rnd[1], 0.95, 1.55),
      between(rnd[2], 1, 4),
    ],
    speed: (ctx, rnd) => between(rnd[3], 3.5, 16.5) * reach(ctx),
    accel: () => [0, -9, 0],
    drag: () => 2.75,
    lifetime: () => 1,
    size: () => 0.25,
  },
  // sandattack_residual.particle.json — a poeira que sobe junto.
  {
    ...dustBase,
    id: 'dust',
    start: 0.1,
    burst: 45,
    anchor: 'origin',
    offset: actorOffset,
    direction: (ctx, rnd) => [
      between(rnd[0], -1.11, 1.11),
      between(rnd[1], 0.85, 1.65),
      between(rnd[2], 1, 4),
    ],
    speed: (ctx, rnd) => between(rnd[3], 2.5, 14.5) * reach(ctx),
    accel: () => [0, -7, 0],
    drag: () => 2.75,
    lifetime: () => 0.55,
    size: () => 0.3,
  },
]

export const SAND_ATTACK_TARGET_EMITTERS = [
  // sandattack_impact.particle.json — os grãos estourando no alvo.
  {
    ...grainBase,
    id: 'grains',
    start: SAND_TRAVEL,
    burst: 25,
    anchor: 'impact',
    offset: () => [0, 0.01, 0],
    direction: (ctx, rnd) => [
      between(rnd[0], -1.61, 1.61),
      between(rnd[1], -0.35, 2.15),
      between(rnd[2], -0.81, 2.21),
    ],
    speed: (ctx, rnd) => between(rnd[3], 5.25, 8.25),
    accel: () => [0, -7.5, 0],
    drag: () => 3,
    lifetime: () => 1,
    size: () => 0.25,
  },
  // sandattack_impactresidual.particle.json — a nuvem de poeira na frente
  // do alvo.
  {
    ...dustBase,
    id: 'cloud',
    start: SAND_TRAVEL + 0.02,
    burst: 35,
    anchor: 'impact',
    offset: (ctx) => [0, 0, ((ctx.body?.length ?? 0.6) / 2) * 0.7],
    direction: (ctx, rnd) => [
      between(rnd[0], -1.11, 1.11),
      between(rnd[1], -0.35, 1.85),
      between(rnd[2], -1.11, 1.11),
    ],
    speed: (ctx, rnd) => between(rnd[3], 1.5, 6.5),
    accel: () => [0, -5, 0],
    drag: () => 3,
    lifetime: () => 0.55,
    size: () => 0.3,
  },
]
