import { compileGradient } from './particleSimulation'

/**
 * Partículas da Pokébola (docs/features/043-captura.md) — tradução manual
 * dos efeitos do Cobblemon (`.exemple/Coblemon/assets/cobblemon/bedrock/
 * particles/balls/`), com as texturas dele (`public/assets/effects/
 * pokeball/`):
 *
 * - **Envio** (`buildSendOutEmitters`, por bola — `<bola>/casual/`): o
 *   clarão (`sendflash`), os brilhos (`ballsendsparkle`) e as faíscas
 *   (`ballsparks`) quando a bola abre — invocar e o selvagem escapando.
 * - **Captura** (`buildCaptureEmitters` — `capture/`): as estrelinhas
 *   (`capturestar`), as faíscas (`capturesparks`) e o brilho que fica
 *   (`afterspark`) no "Capturado!".
 *
 * Conversão: o `size` do billboard do Bedrock é a METADE do lado (aqui é o
 * lado inteiro, ×2); as cores do Bedrock são `#AARRGGBB`; `math.random(a,b)`
 * vira `a + rnd·(b - a)`. A posição (origem) é a da bola.
 */

const BASE = '/assets/effects/pokeball'

// O `math.random(a, b)` do Bedrock com um dos aleatórios da partícula.
const between = (a, b, r) => a + r * (b - a)

// Bedrock `#AARRGGBB` → `#RRGGBB`.
const rgb = (argb) => `#${argb.slice(3, 9)}`

const WHITE = compileGradient([{ at: 0, color: '#ffffff' }])

/**
 * O que muda de bola pra bola no envio: as texturas (e quantos quadros o
 * clarão tem), quantos brilhos, o tamanho das faíscas e os tons. Bola sem
 * perfil usa o da Poké Bola.
 */
export const SEND_OUT_PROFILES = {
  'poke-ball': {
    flashFrames: 12,
    sparkleCount: 4,
    sparkCount: 5,
    sparkSize: 0.1,
    flashTint: WHITE,
    sparkleTint: WHITE,
    sparkTint: WHITE,
  },
  'great-ball': {
    flashFrames: 12,
    sparkleCount: 6,
    sparkCount: 5,
    sparkSize: 0.1,
    flashTint: compileGradient([
      { at: 0, color: '#ffffff' },
      { at: 0.05, color: rgb('#FF71CCFF') },
      { at: 0.08, color: '#ffffff' },
    ]),
    sparkleTint: compileGradient([
      { at: 0, color: '#ffffff' },
      { at: 0.25, color: '#ffffff' },
      { at: 0.65, color: rgb('#FFCA00FF') },
    ]),
    sparkTint: WHITE,
  },
  'ultra-ball': {
    flashFrames: 13,
    sparkleCount: 8,
    sparkCount: 5,
    sparkSize: 0.225,
    flashTint: compileGradient([
      { at: 0, color: '#ffffff' },
      { at: 0.04, color: rgb('#FFFFD971') },
      { at: 0.08, color: '#ffffff' },
    ]),
    sparkleTint: WHITE,
    sparkTint: compileGradient([
      { at: 0.4, color: '#ffffff' },
      { at: 0.6, color: rgb('#FFA300FF') },
    ]),
  },
}

/** Perfil de envio da bola `itemId` (ou o da Poké Bola). */
export function resolveSendOutProfile(itemId) {
  return SEND_OUT_PROFILES[itemId] ?? SEND_OUT_PROFILES['poke-ball']
}

/** Texturas do envio da bola `itemId` (`{ flash, sparkle, sparks }`). */
export function resolveSendOutTexturePaths(itemId) {
  const folder = SEND_OUT_PROFILES[itemId] ? itemId : 'poke-ball'
  return {
    flash: `${BASE}/${folder}/sendflash.png`,
    sparkle: `${BASE}/${folder}/sendsparkle.png`,
    sparks: `${BASE}/${folder}/sparks.png`,
  }
}

export const CAPTURE_TEXTURE_PATHS = {
  star: `${BASE}/capture/star.png`,
  sparks: `${BASE}/capture/sparks.png`,
  afterspark: `${BASE}/capture/afterspark.png`,
}

/** Todas as texturas (pra carregar de uma vez). */
export function listPokeballVfxTexturePaths() {
  const paths = new Set(Object.values(CAPTURE_TEXTURE_PATHS))
  for (const itemId of Object.keys(SEND_OUT_PROFILES)) {
    for (const path of Object.values(resolveSendOutTexturePaths(itemId))) {
      paths.add(path)
    }
  }
  return [...paths]
}

/** A bola abrindo: clarão, brilhos e faíscas (`<bola>/casual/*`). */
export function buildSendOutEmitters(profile) {
  return [
    // sendflash — 1 partícula parada, meio metro acima, 1 s, quadros a 24/s.
    {
      id: 'flash',
      texture: 'flash',
      strip: profile.flashFrames,
      frames: { first: 0, count: profile.flashFrames, fps: 24 },
      blending: 'normal',
      start: 0,
      burst: 1,
      anchor: 'impact',
      offset: () => [0, 0.5, 0],
      direction: () => [0, 1, 0],
      speed: () => 0,
      accel: () => [0, 0, 0],
      drag: () => 0,
      lifetime: () => 1,
      size: () => 1.25 * 2,
      tint: profile.flashTint,
    },
    // ballsendsparkle — espirram pra cima e pros lados, caem e freiam.
    {
      id: 'sparkle',
      texture: 'sparkle',
      strip: 11,
      frames: { first: 0, count: 11, fps: 18 },
      blending: 'normal',
      start: 0,
      burst: profile.sparkleCount,
      anchor: 'impact',
      direction: (ctx, rnd) => [
        between(-10, 10, rnd[0]),
        between(-0.05, 4, rnd[1]) * 4 + 0.5,
        between(-10, 10, rnd[2]),
      ],
      speed: (ctx, rnd) => between(4, 6, rnd[3]) * 2.5,
      accel: () => [0, -6, 0],
      drag: () => 4,
      lifetime: () => 1,
      size: () => 0.15 * 2,
      tint: profile.sparkleTint,
    },
    // ballsparks — como os brilhos, sem gravidade.
    {
      id: 'sparks',
      texture: 'sparks',
      strip: 10,
      frames: { first: 0, count: 10, fps: 18 },
      blending: 'normal',
      start: 0,
      burst: profile.sparkCount,
      anchor: 'impact',
      direction: (ctx, rnd) => [
        between(-10, 10, rnd[0]),
        between(-0.1, 4, rnd[1]) * 3 + 0.5,
        between(-10, 10, rnd[2]),
      ],
      speed: (ctx, rnd) => between(4, 7, rnd[3]) * 2.1,
      accel: () => [0, 0, 0],
      drag: () => 3.5,
      lifetime: () => 1,
      size: () => profile.sparkSize * 2,
      tint: profile.sparkTint,
    },
  ]
}

/** "Capturado!": estrelinhas, faíscas e o brilho que fica (`capture/*`). */
export function buildCaptureEmitters() {
  return [
    // capturestar — sobem girando e freiam, quase sem cair.
    {
      id: 'stars',
      texture: 'star',
      strip: 13,
      frames: { first: 0, count: 13, fps: 24 },
      blending: 'normal',
      start: 0,
      burst: 5,
      anchor: 'impact',
      direction: (ctx, rnd) => [
        between(-1, 1, rnd[0]) * 5,
        between(0.5, 2, rnd[1]) * 3 + 1,
        between(-10, 10, rnd[2]),
      ],
      speed: (ctx, rnd) => between(3.5, 4.1, rnd[3]) * 3.25,
      accel: () => [0, -0.5, 0],
      drag: () => 4.25,
      lifetime: () => 1,
      size: () => 0.175 * 2,
      // `initial_spin` do original: um giro sorteado (em quartos de volta).
      spin: (rnd) => rnd[6] * 4,
      tint: WHITE,
    },
    // capturesparks — espirram e caem.
    {
      id: 'sparks',
      texture: 'sparks',
      strip: 6,
      frames: { first: 0, count: 6, fps: 12 },
      blending: 'normal',
      start: 0,
      burst: 6,
      anchor: 'impact',
      direction: (ctx, rnd) => [
        between(-10, 10, rnd[0]),
        between(-0.05, 4, rnd[1]) * 5 + 0.5,
        between(-10, 10, rnd[2]),
      ],
      speed: (ctx, rnd) => between(4, 7, rnd[3]) * 2.25,
      accel: () => [0, -6, 0],
      drag: () => 5,
      lifetime: () => 1,
      size: () => 0.1 * 2,
      tint: WHITE,
    },
    // afterspark — por 1 s, brilhos nascendo em volta e subindo devagar
    // (o original solta 20/s até 7 vivos: 7 no segundo).
    {
      id: 'afterspark',
      texture: 'afterspark',
      strip: 4,
      frames: { first: 0, count: 4, fps: 12 },
      blending: 'normal',
      start: 0,
      duration: 1,
      rate: () => 7,
      anchor: 'impact',
      offset: (ctx, rnd) => [
        -between(-0.25, 0.25, rnd[0]) * 3.75,
        0.5 - between(-0.25, 0.25, rnd[1]) * 3.75,
        -between(-0.25, 0.25, rnd[2]) * 3.75,
      ],
      direction: () => [0, 1, 0],
      speed: () => 0.4,
      accel: () => [0, 0, 0],
      drag: () => 0,
      lifetime: () => 1,
      size: (t, rnd) => (0.05 + between(0.03, 0.06, rnd[3])) * 2,
      tint: WHITE,
    },
  ]
}
