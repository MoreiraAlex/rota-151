import { compileGradient } from './particleSimulation'
import { STRING_SHOT_TEXTURE_PATHS } from './stringShotVfx'

/**
 * Enrolar (Wrap) em partículas. O Cobblemon não tem o golpe: anéis grossos
 * do tamanho do corpo do alvo, com a textura do anel do String Shot
 * (`wrap`, o primeiro quadro, inteiro), num lilás de corpo de cobra.
 * Mesmo contrato de `ctx`/`rnd` de `emberVfx.js`; nascem no centro do corpo,
 * virados como ele, e o tamanho vem do corpo (`ctx.body`, `size(t, rnd,
 * body)`).
 *
 * - `WRAP_TARGET_EMITTERS` (no acerto, em cada alvo — `targetEffectGroup:
 *   'wrap-target'`): os anéis chegam largos e APERTAM até encostar no corpo,
 *   um depois do outro, de baixo pra cima.
 * - `WRAP_BODY_EMITTERS` (no corpo, ENQUANTO estiver Preso — `visual.body:
 *   'wrap'` da condição): os anéis ficam apertados em volta, renovando, com
 *   um aperto leve e ritmado.
 *
 * Espaço local: +Z a frente do corpo; o acerto nasce no centro dele, o
 * efeito do corpo nos pés.
 */

export const WRAP_TEXTURE_PATHS = { wrap: STRING_SHOT_TEXTURE_PATHS.wrap }

// Corpo de quem não informa o tamanho (m), como no String Shot.
const DEFAULT_BODY = { width: 0.6, length: 0.6, height: 0.65 }
const bodyOf = (body) => body ?? DEFAULT_BODY

// Alturas dos anéis no corpo (fração da altura, a partir dos pés) e quanto o
// anel passa do corpo: largo ao chegar, encostado depois de apertar.
const RING_HEIGHTS = [0.25, 0.5, 0.75]
const RING_WIDE = 1.7
const RING_TIGHT = 1.08
// Quando cada anel chega (s) e quanto leva pra apertar.
const RING_STAGGER = 0.08
const SQUEEZE_TIME = 0.22
const TARGET_RING_LIFETIME = 0.9

const RING_TINT = compileGradient([
  { at: 0, color: '#c9a6e0' },
  { at: 1, color: '#8d67a8' },
])

// O anel deitado no tamanho do corpo: [de frente, de lado].
const ring = (body, factor) => {
  const { width, length } = bodyOf(body)
  return [length * factor, width * factor]
}
const easeOut = (x) => 1 - (1 - x) * (1 - x)
// A altura do anel (fração do corpo, dos pés pra cima), desfeita da escala
// (o `offset` é multiplicado pelo `visual.scale`). O efeito do acerto nasce
// no centro do corpo (`from` meia altura); o do corpo, nos pés.
const ringOffset = (ctx, fraction, from = 0) => [
  0,
  ((fraction - from) * bodyOf(ctx.body).height) / ctx.scale,
  0,
]

const ringBase = {
  texture: 'wrap',
  strip: 9,
  frames: { first: 0, count: 1, fps: 1 },
  facing: 'plane',
  blending: 'normal',
  burst: 1,
  anchor: 'impact',
  // parado: o quadro `plane` se orienta pela direção
  direction: () => [0, 0, 1],
  speed: () => 0,
  accel: () => [0, 0, 0],
  drag: () => 0,
  spin: false,
  tint: RING_TINT,
}

export const WRAP_TARGET_EMITTERS = RING_HEIGHTS.map((fraction, index) => ({
  ...ringBase,
  id: `squeeze-${index}`,
  start: index * RING_STAGGER,
  offset: (ctx) => ringOffset(ctx, fraction, 0.5),
  lifetime: () => TARGET_RING_LIFETIME,
  // largo → encostado no começo da vida, e fica
  size: (t, rnd, body) => {
    const squeeze = Math.min((t * TARGET_RING_LIFETIME) / SQUEEZE_TIME, 1)
    return ring(body, RING_WIDE + (RING_TIGHT - RING_WIDE) * easeOut(squeeze))
  },
}))

// Preso: anéis por segundo em cada altura, a vida de cada um e o aperto
// ritmado (quanto o anel encolhe a mais, por ciclo da vida).
const BODY_RATE = 2
const BODY_LIFETIME = 1.2
const BODY_PULSE = 0.06

export const WRAP_BODY_EMITTERS = RING_HEIGHTS.map((fraction, index) => ({
  ...ringBase,
  id: `bound-${index}`,
  burst: undefined,
  start: 0,
  continuous: true,
  rate: () => BODY_RATE,
  offset: (ctx) => ringOffset(ctx, fraction),
  lifetime: () => BODY_LIFETIME,
  size: (t, rnd, body) =>
    ring(body, RING_TIGHT - BODY_PULSE * Math.sin(t * Math.PI * 2) ** 2),
}))
