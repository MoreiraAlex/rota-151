import { compileGradient } from './particleSimulation'

/**
 * Olhar Penetrante (Leer) em partículas — tradução do `leer_gleam` do
 * Cobblemon (`.exemple/Coblemon/assets/cobblemon/bedrock/particles/moves/
 * leer/` e a linha do tempo em `data/cobblemon/action_effects/moves/
 * leer.json`). Mesmo contrato de `ctx`/`rnd` de `emberVfx.js`. Grupo `'leer'`
 * de `visual.actionGroup`: preso ao corpo de quem usa, no `effectAt`.
 *
 *   - `gleam-left`/`gleam-right` — o brilho em cada olho, um flipbook
 *     amarelo que pisca no branco (o original tem um só)
 *
 * O original nasce no localizador do olho; aqui o olho de cada espécie é o
 * `visual.positionOffset` (override na entrada dela). Espaço local: o pivô
 * em (0, 0, 0), +Z pra onde a criatura olha — o eixo Z do Bedrock aponta pro
 * lado oposto, então o `z` foi INVERTIDO na tradução.
 */

export const LEER_TEXTURE_PATHS = {
  sparkle: '/assets/effects/leer/mediumsparkle.png',
}

// Amarelo, branco no pico do brilho, e de volta ao amarelo (o gradiente
// ARGB, todo opaco).
const GLEAM_TINT = compileGradient([
  { at: 0, color: '#fff34e' },
  { at: 0.18, color: '#ffffff' },
  { at: 0.5, color: '#fff34e' },
  { at: 1, color: '#ffcd55' },
])

// Meia distância entre os dois olhos (m, ×`visual.scale`): o original tem um
// brilho só (um localizador); aqui um em cada olho.
export const EYE_SPREAD = 0.05

export const LEER_EMITTERS = [-1, 1].map((side) => ({
  // leer_gleam.particle.json — um brilho em cada olho, um pouco à frente.
  id: `gleam-${side < 0 ? 'left' : 'right'}`,
  texture: 'sparkle',
  strip: 7,
  frames: { first: 0, count: 7, fps: 14 },
  blending: 'normal',
  start: 0,
  burst: 1,
  anchor: 'impact',
  offset: () => [side * EYE_SPREAD, 0, 0.1],
  direction: () => [0, 0, 1],
  speed: () => 0,
  accel: () => [0, 0, 0],
  drag: () => 0,
  lifetime: () => 0.3,
  size: () => 0.25,
  spin: false,
  tint: GLEAM_TINT,
}))
