import { compileGradient } from './particleSimulation'
import { piecewise } from './biteVfx'

/**
 * Garantia (Assurance) em partículas. O Cobblemon não tem o golpe: é o
 * acerto do Pursuit (`.exemple/Coblemon/assets/cobblemon/bedrock/particles/
 * moves/pursuit/` e a linha do tempo em `data/cobblemon/action_effects/
 * moves/pursuit.json`), Sombrio como o Assurance na série. Mesmo contrato de
 * `ctx`/`rnd` de `emberVfx.js`; só o IMPACTO no alvo:
 *
 *   - `mark-N` — a marca escura no alvo (`pursuit_target`), um flipbook
 *   - `hit`    — o golpe azul-escuro (`pursuit_targethit`, textura `hit`)
 *   - `dots`   — os pontos escuros estourando pra fora (`pursuit_targetdots`)
 *
 * A linha do tempo do Pursuit foi encurtada (lá o golpe vem bem depois da
 * marca; aqui o dano já saiu no `effectAt`). No acerto com o poder maior
 * (quem apanhou há pouco) o efeito todo sai maior, pelo
 * `visual.boostedScale` (`attackImpact.js`). Espaço local: impacto em
 * (0, 0, 0), +Z na direção do golpe — o eixo Z do Bedrock aponta pro lado
 * oposto, então todo `z` foi INVERTIDO na tradução.
 */

export const ASSURANCE_TEXTURE_PATHS = {
  pursuit: '/assets/effects/assurance/pursuit.png',
  hit: '/assets/effects/impact/hit.png',
  orb: '/assets/effects/leech-seed/xsfadeorb.png',
}

// Quando cada marca aparece e quando vem o golpe (s).
const MARK_STARTS = [0, 0.15]
export const ASSURANCE_HIT_AT = 0.2

// O azul-escuro do golpe e dos pontos (os gradientes ARGB); os pontos somem
// no fim.
const HIT_TINT = compileGradient([
  { at: 0, color: '#697bb8' },
  { at: 1, color: '#1f294b' },
])
const DOTS_TINT = compileGradient([
  { at: 0, color: '#697bb8' },
  { at: 0.72, color: '#1f294b' },
  { at: 1, color: '#588dff' },
])
const DOTS_ALPHA = [
  [0, 1],
  [0.72, 1],
  [1, 0],
]
const MARK_TINT = compileGradient([{ at: 0, color: '#ffffff' }])

// `math.random(a, b)` com uma random da partícula.
const between = (r, a, b) => a + r * (b - a)

const still = {
  burst: 1,
  anchor: 'impact',
  direction: () => [0, 0, 1],
  speed: () => 0,
  accel: () => [0, 0, 0],
  drag: () => 0,
}

export const ASSURANCE_EMITTERS = [
  // pursuit_target.particle.json — a marca, mais de uma vez.
  ...MARK_STARTS.map((start, index) => ({
    ...still,
    id: `mark-${index}`,
    texture: 'pursuit',
    strip: 10,
    frames: { first: 0, count: 10, stretch: true },
    blending: 'normal',
    start,
    offset: () => [0, 0, 0.3],
    lifetime: () => 0.4,
    size: () => 0.75,
    spin: false,
    tint: MARK_TINT,
  })),
  // pursuit_targethit.particle.json — o golpe, de pé ou deitado.
  {
    ...still,
    id: 'hit',
    texture: 'hit',
    strip: 5,
    vertical: true,
    frames: { first: 0, count: 5, stretch: true },
    blending: 'normal',
    start: ASSURANCE_HIT_AT,
    offset: () => [0, 0, 0.2],
    lifetime: () => 0.2,
    size: () => 1,
    spin: (rnd) => Math.floor(rnd[0] * 2),
    tint: HIT_TINT,
  },
  // pursuit_targetdots.particle.json — de uma esfera pequena, pra fora.
  {
    id: 'dots',
    texture: 'orb',
    strip: 9,
    frames: { first: 3, count: 6, stretch: true },
    blending: 'normal',
    start: ASSURANCE_HIT_AT,
    burst: 20,
    anchor: 'impact',
    offset: () => [0, 0, 0.25],
    shellRadius: () => 0.025,
    direction: (ctx, rnd) => [rnd[0] - 0.5, rnd[1] - 0.5, rnd[2] - 0.5],
    speed: (ctx, rnd) => between(rnd[3], 2.1, 6.3) * ctx.scale,
    accel: () => [0, 0, 0],
    drag: () => 1.5,
    lifetime: () => 0.4,
    size: (t, rnd) => 0.1 - rnd[1] * 0.05,
    spin: false,
    tint: DOTS_TINT,
    alpha: (t) => piecewise(DOTS_ALPHA, t),
  },
]
