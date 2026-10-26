import { compileGradient, sampleCurve } from './particleSimulation'
import { piecewise } from './biteVfx'
import {
  THUNDER_SHOCK_EMITTERS,
  THUNDER_SHOCK_TEXTURE_PATHS,
} from './thunderShockVfx'

/**
 * Bola Elétrica (Electro Ball) em partículas. O Cobblemon não tem o golpe: é
 * o Shadow Ball (`.exemple/Coblemon/assets/cobblemon/bedrock/particles/
 * moves/shadowball/` e a linha do tempo em `data/cobblemon/action_effects/
 * moves/shadowball.json`) em amarelo elétrico, com o impacto do Thunder
 * Shock (`thunderShockVfx.js`). Mesmo contrato de `ctx`/`rnd` de
 * `emberVfx.js`. Dois efeitos:
 *
 * - `ELECTRO_BALL_CHARGE_EMITTERS` (`visual.chargeGroup:
 *   'electro-ball-charge'`, do disparo ao `effectAt`, nos pés de quem usa,
 *   virado pra onde ele olha): `gather` — faíscas de uma esfera grande
 *   correndo pro ponto da bola, na frente do peito (`shadowball_actorcharge`);
 *   `orb` — a bola se formando ali (`_actorblob`); `flare` — fagulhas
 *   escapando dela (`_actorflaring`).
 * - `ELECTRO_BALL_EMITTERS` (`visual.effectGroup: 'electro-ball'`, no
 *   `effectAt`, no contato com o alvo): `launch` — o anel do lançamento
 *   (`_actorlaunch`); `ball` — a bola voando até o alvo em `BALL_TRAVEL`
 *   (`_targetblob`), com o rastro de fagulhas; quando chega, o impacto do
 *   Thunder Shock (faíscas, choque e estilhaços).
 *
 * Espaço local do golpe: impacto em (0, 0, 0), criatura em (0, 0, -length),
 * +Z na direção do golpe — o eixo Z do Bedrock aponta pro lado oposto, então
 * todo `z` foi INVERTIDO na tradução.
 */

export const ELECTRO_BALL_TEXTURE_PATHS = {
  ...THUNDER_SHOCK_TEXTURE_PATHS,
  orb: '/assets/effects/electro-ball/mediumfadeorb.png',
  ring: '/assets/effects/electro-ball/psyring2.png',
}

// Quanto a bola leva pra chegar no alvo (s).
export const BALL_TRAVEL = 0.3

// Onde a bola se forma na carga: na frente do peito (m a partir dos pés, e
// fração da altura), e o raio da esfera de onde as faíscas vêm.
const BALL_AHEAD = 0.35
const BALL_HEIGHT = 0.55
const GATHER_RADIUS = 0.7

// Amarelo elétrico no lugar do roxo do Shadow Ball (os gradientes ARGB).
const GATHER_TINT = compileGradient([
  { at: 0, color: '#6b5a10' },
  { at: 0.42, color: '#fff6b0' },
  { at: 1, color: '#e6a400' },
])
const GATHER_ALPHA = [
  [0, 0],
  [0.42, 1],
  [1, 1],
]
const ORB_TINT = compileGradient([
  { at: 0, color: '#fffbd1' },
  { at: 1, color: '#ffd84a' },
])
const ORB_ALPHA = [
  [0, 0],
  [0.2, 1],
  [0.75, 1],
  [1, 0],
]
const RING_TINT = compileGradient([
  { at: 0, color: '#fff27a' },
  { at: 0.4, color: '#ffd000' },
  { at: 1, color: '#c48a00' },
])
const RING_ALPHA = [
  [0, 1],
  [0.4, 1],
  [1, 0],
]

// `variable.shadowcharge`, `flarefade` e `shadowlaunch` dos JSONs.
const CHARGE_SIZE = [0, 0.51, 0.85, 1]
const FLARE_FADE = [1, 1, 1, 1, 1, 1, 0.96, 0.85, 0.5, 0]
const LAUNCH_SIZE = [0.2, 0.7, 0.93, 1]

// Um ponto da esfera unitária pelas randoms (o mesmo `rnd` da partícula no
// `offset` e na `direction`: a faísca corre pro centro de onde nasceu).
const spherePoint = (rnd) => {
  const z = rnd[0] * 2 - 1
  const angle = rnd[1] * Math.PI * 2
  const r = Math.sqrt(1 - z * z)
  return [Math.cos(angle) * r, z, Math.sin(angle) * r]
}
// O centro da bola na carga, desfeito da escala (o `offset` é ×escala).
const ballCenter = (ctx) => [
  0,
  Math.max(ctx.height * BALL_HEIGHT, 0.15) / ctx.scale,
  BALL_AHEAD / ctx.scale,
]

export const ELECTRO_BALL_CHARGE_EMITTERS = [
  // shadowball_actorcharge.particle.json — da esfera pro centro.
  {
    id: 'gather',
    texture: 'electric',
    strip: 7,
    vertical: true,
    frames: { first: 0, count: 7, stretch: true },
    blending: 'additive',
    start: 0,
    continuous: true,
    rate: () => 90,
    anchor: 'impact',
    offset: (ctx, rnd) => {
      const [x, y, z] = spherePoint(rnd)
      const [cx, cy, cz] = ballCenter(ctx)
      const r = GATHER_RADIUS / ctx.scale
      return [cx + x * r, cy + y * r, cz + z * r]
    },
    direction: (ctx, rnd) => spherePoint(rnd).map((value) => -value),
    // chega no centro quando a vida acaba (`v / drag ≈ raio`)
    speed: () => GATHER_RADIUS * 5,
    accel: () => [0, 0, 0],
    drag: () => 5,
    lifetime: () => 0.7,
    size: (t) => 0.175 * sampleCurve(CHARGE_SIZE, t),
    spin: true,
    tint: GATHER_TINT,
    alpha: (t) => piecewise(GATHER_ALPHA, t),
  },
  // shadowball_actorblob.particle.json — a bola se formando.
  {
    id: 'orb',
    texture: 'orb',
    strip: 11,
    frames: { first: 0, count: 11, stretch: true },
    blending: 'additive',
    start: 0,
    continuous: true,
    rate: () => 30,
    anchor: 'impact',
    offset: (ctx, rnd) => {
      const [x, y, z] = spherePoint(rnd)
      const [cx, cy, cz] = ballCenter(ctx)
      return [cx + x * 0.2, cy + y * 0.2, cz + z * 0.2]
    },
    direction: (ctx, rnd) => spherePoint(rnd).map((value) => -value),
    speed: () => 0.3,
    accel: () => [0, 0, 0],
    drag: () => 0.5,
    lifetime: () => 0.7,
    size: () => 0.25,
    spin: false,
    tint: ORB_TINT,
    alpha: (t) => piecewise(ORB_ALPHA, t),
  },
  // shadowball_actorflaring.particle.json — fagulhas pra fora, subindo.
  {
    id: 'flare',
    texture: 'electric',
    strip: 7,
    vertical: true,
    frames: { first: 0, count: 7, stretch: true },
    blending: 'additive',
    start: 0,
    continuous: true,
    rate: () => 35,
    anchor: 'impact',
    offset: (ctx, rnd) => {
      const [x, y, z] = spherePoint(rnd)
      const [cx, cy, cz] = ballCenter(ctx)
      return [cx + x * 0.25, cy + y * 0.25, cz + z * 0.25]
    },
    direction: (ctx, rnd) => spherePoint(rnd),
    speed: () => 0.75,
    accel: () => [0, 1.5, 0],
    drag: () => 1,
    lifetime: () => 0.7,
    size: (t) => 0.125 * sampleCurve(FLARE_FADE, t),
    spin: true,
    tint: GATHER_TINT,
  },
]

// O impacto do Thunder Shock, quando a bola chega (sem o raio dele).
const impactEmitters = THUNDER_SHOCK_EMITTERS.filter(
  (spec) => spec.id !== 'bolt',
).map((spec) => ({ ...spec, id: `impact-${spec.id}`, start: BALL_TRAVEL }))

export const ELECTRO_BALL_EMITTERS = [
  // shadowball_actorlaunch.particle.json — o anel na saída.
  {
    id: 'launch',
    texture: 'ring',
    strip: 9,
    frames: { first: 0, count: 9, stretch: true },
    blending: 'additive',
    start: 0,
    burst: 1,
    anchor: 'origin',
    offset: () => [0, 0, 0.4],
    direction: () => [0, 0, 1],
    speed: () => 0,
    accel: () => [0, 0, 0],
    drag: () => 0,
    lifetime: () => 0.35,
    size: (t) => 1.1 * sampleCurve(LAUNCH_SIZE, t),
    spin: false,
    tint: RING_TINT,
    alpha: (t) => piecewise(RING_ALPHA, t),
  },
  // shadowball_targetblob.particle.json — a bola atravessando até o alvo.
  {
    id: 'ball',
    texture: 'orb',
    strip: 11,
    frames: { first: 2, count: 5, fps: 30, loop: true },
    blending: 'additive',
    start: 0,
    burst: 1,
    anchor: 'origin',
    direction: () => [0, 0, 1],
    speed: (ctx) => ctx.length / BALL_TRAVEL,
    accel: () => [0, 0, 0],
    drag: () => 0,
    lifetime: () => BALL_TRAVEL,
    size: () => 0.35,
    spin: false,
    tint: ORB_TINT,
  },
  // o rastro de fagulhas por onde a bola passa
  {
    id: 'trail',
    texture: 'electric',
    strip: 7,
    vertical: true,
    frames: { first: 0, count: 7, stretch: true },
    blending: 'additive',
    start: 0,
    duration: BALL_TRAVEL,
    rate: () => 60,
    anchor: 'path',
    direction: (ctx, rnd) => [rnd[0] - 0.5, rnd[1] - 0.5, rnd[2] - 0.5],
    speed: () => 0.6,
    accel: () => [0, 0, 0],
    drag: () => 2,
    lifetime: () => 0.3,
    size: (t) => 0.1 * (1 - t),
    spin: true,
    tint: GATHER_TINT,
  },
  ...impactEmitters,
]
