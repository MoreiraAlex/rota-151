import { compileGradient } from './particleSimulation'

/**
 * Tackle em partículas — tradução manual das definições do Cobblemon
 * (`.exemple/Coblemon/assets/cobblemon/bedrock/particles/moves/tackle/` e a
 * linha do tempo em `data/cobblemon/action_effects/moves/tackle.json`).
 * Mesmo contrato de `ctx`/`rnd` de `emberVfx.js`. O Tackle do Cobblemon é
 * só o IMPACTO no alvo (o resto do golpe é a animação do corpo da
 * criatura), então os dois emissores nascem no ponto de impacto, no
 * instante em que o efeito nasce (`effectAt` do ataque):
 *
 *   - `hit`     — clarão amarelo (flipbook)
 *   - `sparks`  — faíscas que saltam e caem
 *
 * As texturas são empilhadas na VERTICAL (quadro 0 = o de cima).
 * Sem a colisão com o chão (`expire_on_contact`) do original.
 */

export const TACKLE_TEXTURE_PATHS = {
  hit: '/assets/effects/tackle/hit_yellow.png',
  orb: '/assets/effects/tackle/scalingshaded.png',
}

const HIT_TINT = compileGradient([
  { at: 0.15, color: '#ffffff' },
  { at: 0.7, color: '#ffab6f' },
  { at: 1, color: '#ff4c32' },
])
export const SPARK_TINT = compileGradient([
  { at: 0, color: '#ffffff' },
  { at: 0.32, color: '#ffffff' },
  { at: 0.73, color: '#fff087' },
  { at: 0.93, color: '#ffc986' },
])

export const TACKLE_EMITTERS = [
  // tackle_target.particle.json — 1 partícula parada, 1 m, vida 0.2 s.
  {
    id: 'hit',
    texture: 'hit',
    strip: 5,
    vertical: true,
    frames: { first: 0, count: 5, step: 1, stretch: true },
    blending: 'normal',
    start: 0,
    burst: 1,
    anchor: 'impact',
    direction: () => [0, 0, 1],
    speed: () => 0,
    accel: () => [0, 0, 0],
    drag: () => 0,
    lifetime: () => 0.2,
    size: () => 1,
    spin: false,
    tint: HIT_TINT,
  },
  // tackle_targetsparks.particle.json — `max(entity_width * 5, 7)` partículas;
  // sem a largura da criatura alvo aqui, fica no piso de 7.
  {
    id: 'sparks',
    texture: 'orb',
    strip: 4,
    vertical: true,
    // `base_UV [0, 16]`, `step_UV [0, -8]`: começa na 3ª linha e sobe
    frames: { first: 2, count: 3, step: -1, stretch: true },
    blending: 'normal',
    start: 0,
    burst: 7,
    anchor: 'impact',
    direction: (ctx, rnd) => [
      (rnd[4] * 2 - 1) * 0.9,
      -0.4 + rnd[5] * 1.5,
      (rnd[6] * 2 - 1) * 0.9,
    ],
    speed: (ctx, rnd) => 5 + rnd[7] * 2,
    accel: () => [0, -9, 0],
    drag: () => 0.25,
    lifetime: (ctx, rnd) => 0.35 + rnd[8] * 0.15,
    size: () => 0.15,
    spin: false,
    tint: SPARK_TINT,
  },
]
