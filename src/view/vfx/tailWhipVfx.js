import { compileGradient, sampleCurve } from './particleSimulation'

/**
 * Tail Whip (Chicote de Cauda) em partículas — tradução manual de
 * `tailwhip_actor.particle.json` e `tailwhip_actorsparkle.particle.json`
 * (`.exemple/Coblemon/assets/cobblemon/bedrock/particles/moves/tailwhip/`),
 * no ritmo de `animation.tailwhip.actor` (`bedrock/generic/animations/moves/
 * tailwhip.animation.json`). Grupo `'tail-whip'` de `visual.actionGroup`:
 * nasce no `effectAt`, preso à criatura (`ContinuousAttackEffectsView.jsx`).
 *
 * UMA abanada da cauda: uma varrida (`swipe`) e dois punhados de brilhos
 * (`sparkle`), e termina sozinha — sem repetir (no original as abanadas
 * se repetem; aqui o golpe "acontece" uma vez, no
 * `effectAt`):
 *
 *   sparkle → swipe → sparkle
 *
 * Espaço local = o da criatura, mas com a origem no PIVÔ do efeito: o ponto
 * `TAIL_WHIP_PIVOT` m à frente do CENTRO do corpo (quem acompanha a criatura —
 * `ContinuousAttackEffectsView.jsx` — põe a origem do quadro ali), +Z pra onde
 * ela olha, +Y pra cima (`ctx.height` = altura do corpo; Y = 0 é a altura do
 * centro). Os brilhos voam pra FRENTE, na direção do alvo. (No original é o
 * contrário — o +Z do Bedrock aponta pra trás, ver `dashVfx.js` —, porque lá a
 * criatura dá as costas pro alvo antes de abanar; aqui o corpo não gira.) Pra
 * mudar posição ou direção, use só a skill: `visual.positionOffset` desloca o
 * pivô, `visual.rotationOffset.y` gira o efeito EM VOLTA do pivô (sem sair do
 * lugar) e `visual.rotationOffset.z` gira as partículas no plano da tela.
 *
 * A varrida é um arco em "U" (côncavo pra cima). Visto da câmera — atrás e
 * acima da criatura — o "U" lê como um arco no chão com as pontas pra frente e
 * o meio encostado no corpo: uma onda VINDO na criatura. Por isso a skill usa
 * `rotationOffset.z: 180`: o arco vira "∩" e lê como onda SAINDO dela.
 *
 * `entity_width` do original fica no mínimo do `math.clamp` (0.5) pra uma
 * criatura do tamanho das daqui; a altura (`0.33 × entity_height` acima dos
 * pés) usa a altura real do corpo. `visual.scale` encolhe/aumenta tudo
 * (posição e tamanho pelo motor; velocidade e aceleração aqui).
 */

export const TAIL_WHIP_TEXTURE_PATHS = {
  swipe: '/assets/effects/tail-whip/softswipe.png',
  sparkle: '/assets/effects/tail-whip/sparkle.png',
}

// `math.clamp(v.entity_width, 0.5, 20)` no mínimo.
const BODY_WIDTH = 0.5

// Distância (m, ×`visual.scale`) do centro do corpo até o pivô do efeito: onde
// a varrida fica. Os offsets abaixo são contados a partir dele.
export const TAIL_WHIP_PIVOT = BODY_WIDTH * 1.05

// `particle_appearance_tinting` da varrida: branco com alfa 0.56.
const SWIPE_TINT = compileGradient([{ at: 0, color: '#ffffff' }])
const SWIPE_OPACITY = 0.56

// `variable.crtrailsize` dos brilhos (nós ao longo da vida).
const SPARKLE_SIZE = [0, 0.67, 1, 1, 0.9, 0.5, 0]
const SPARKLE_TINT = compileGradient([
  { at: 0, color: '#0097ea' },
  { at: 0.23, color: '#ffeff9' },
  { at: 0.75, color: '#bf87db' },
  { at: 1, color: '#002c8f' },
])

const deg = (degrees) => (degrees * Math.PI) / 180

// `math.clamp(v.entity_height × 0.33, 0.2, 20)` acima dos pés, contado a
// partir do centro do corpo (a origem do quadro).
const tailHeight = (ctx) => Math.max(ctx.height * 0.33, 0.2) - ctx.height / 2

// tailwhip_actor — UMA varrida parada na frente do corpo, 0.5 s, flipbook de 8 quadros
// (28×7 px cada) a 16 fps. O `emitter_transform_xy` do original (o quadro de
// pé, virado pro eixo do corpo) vira billboard: a câmera fica atrás da
// criatura, olhando quase nesse mesmo eixo.
const SWIPE = {
  id: 'swipe',
  texture: 'swipe',
  strip: 8,
  frames: { first: 0, count: 8, fps: 16 },
  blending: 'normal',
  opacity: SWIPE_OPACITY,
  start: 0.04,
  burst: 1,
  anchor: 'impact',
  offset: (ctx) => [0, tailHeight(ctx), 0],
  direction: () => [0, 0, 1],
  speed: () => 0,
  accel: () => [0, 0, 0],
  drag: () => 0,
  lifetime: () => 0.5,
  // [largura, altura]: `0.56 × clamp(entity_width × 0.8, 1, 2.5)` no mínimo
  size: () => [0.56, 0.14],
  spin: false,
  tint: SWIPE_TINT,
}

// tailwhip_actorsparkle — 60/s por 0.125 s: o ponto de emissão balança de um
// lado pro outro (o `sin(idade × 2590°)`) na frente do corpo e cada brilho sai
// pra frente, subindo e freando.
function sparkleSpec(start, index) {
  return {
    id: `sparkle-${index}`,
    texture: 'sparkle',
    strip: 2,
    vertical: true,
    frames: { first: 0, count: 2, fps: 3 },
    blending: 'normal',
    start,
    duration: 0.125,
    rate: () => 60,
    anchor: 'impact',
    offset: (ctx, rnd) => [
      Math.sin(deg(ctx.age * 2590)) * BODY_WIDTH,
      tailHeight(ctx) + (rnd[0] - 0.5) * 0.33,
      BODY_WIDTH - TAIL_WHIP_PIVOT + rnd[1] * 0.1,
    ],
    direction: (ctx, rnd) => [
      Math.sin(deg(ctx.age * 2590)) * (rnd[0] * 0.25),
      (rnd[1] - 0.5) * 0.33,
      (rnd[2] + 0.5) * 0.25,
    ],
    speed: (ctx, rnd) => (2.5 - rnd[3]) * ctx.scale,
    accel: (ctx) => [0, 1 * ctx.scale, 0],
    drag: (ctx, rnd) => rnd[3] * 0.5 * 6,
    lifetime: (ctx, rnd) => 0.45 + rnd[3] * 0.1,
    size: (t, rnd) => (0.09 - rnd[3] * 0.04) * sampleCurve(SPARKLE_SIZE, t),
    spin: false,
    tint: SPARKLE_TINT,
  }
}

export const TAIL_WHIP_EMITTERS = [
  SWIPE,
  sparkleSpec(0, 0),
  sparkleSpec(0.25, 1),
]
