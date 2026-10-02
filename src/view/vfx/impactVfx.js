import { compileGradient, sampleCurve } from './particleSimulation'
import { IMPACT_TYPES, resolveImpactType } from '@/core/data/impactTypes'

/**
 * Impacto GENÉRICO por tipo, em partículas — tradução manual das definições
 * do Cobblemon (`.exemple/Coblemon/assets/cobblemon/bedrock/particles/
 * generic/`: `hit*.particle.json` e `impact_<tipo>.particle.json`). Serve de
 * visual padrão pra qualquer golpe físico simples (o ataque básico das
 * criaturas), com a cor/forma das faíscas mudando pelo TIPO. Mesmo contrato
 * de `ctx`/`rnd` de `emberVfx.js`; tudo nasce no ponto de impacto, no
 * instante em que o efeito nasce:
 *
 *   - `hit`     — clarão (`hit.png`); dragão e veneno têm o seu,
 *                     colorido e mais longo (`hit_dragon`, `hit_poison`)
 *   - `impact`  — rajada de faíscas do tipo (ver `TYPES`)
 *
 * As texturas são empilhadas na VERTICAL (quadro 0 = o de cima, 7 quadros
 * por faísca). O `impact_steel.png` tem 2 colunas e usa só a da direita.
 *
 * Diferenças pro original:
 * - O Cobblemon escala o emissor pelo tamanho da criatura
 *   (`emitter_space: entity`); aqui `SPEED_FACTOR` encolhe o alcance das
 *   faíscas pra criaturas pequenas e `visual.scale` cresce tudo junto. Valor
 *   de PARTIDA — ajustar vendo em jogo.
 * - `impact_bug` sorteia a aceleração a CADA frame, crescendo ao longo da vida;
 *   aqui é uma aceleração aleatória por partícula (fixa), de módulo médio.
 * - Sem colisão com o chão (`impact_rock`/`impact_steel` quicam no original).
 */

// A lista de tipos e a resolução vivem no núcleo (o som usa a mesma).
export { IMPACT_TYPES, resolveImpactType }

// Quanto do alcance do original as faíscas mantêm (ver cabeçalho).
const SPEED_FACTOR = 0.4

const WHITE = compileGradient([{ at: 0, color: '#ffffff' }])
const SIZE_OVER_LIFE = [1, 0]

// Defaults = `impact_normal.particle.json`; cada tipo sobrescreve o que muda.
const DEFAULTS = {
  count: 10,
  life: [0.2, 0.5],
  speed: [10, 15],
  drag: 5,
  accel: [0, 0, 0],
  size: 0.2,
  tint: WHITE,
  upward: false,
  wander: false,
}

const TYPES = {
  normal: {},
  fire: { size: 0.3 },
  water: { size: 0.3 },
  grass: { size: 0.3 },
  electric: {
    size: 0.3,
    tint: compileGradient([
      { at: 0, color: '#ffffff' },
      { at: 0.67, color: '#ff9400' },
    ]),
  },
  ice: {
    life: [0.5, 0.9],
    accel: [0, -3, 0],
    tint: compileGradient([
      { at: 0.27, color: '#aefff4' },
      { at: 0.5, color: '#ffffff' },
    ]),
  },
  fighting: {
    count: 12,
    tint: compileGradient([
      { at: 0.28, color: '#ffffff' },
      { at: 0.5, color: '#ff7b7b' },
    ]),
  },
  poison: {
    // `math.random(0.5, 0.2)` no original (faixa invertida) = 0.2 a 0.5
    life: [0.2, 0.5],
    speed: [10, 13],
    accel: [0, 3, 0],
    size: 0.4,
    hit: 'poison',
  },
  ground: { size: 0.4 },
  flying: { life: [0.7, 0.9], accel: [0, -3, 0], size: 0.3 },
  psychic: {
    life: [0.7, 0.9],
    speed: [15, 15],
    drag: 7,
    size: 0.3,
    tint: compileGradient([
      { at: 0, color: '#af5aff' },
      { at: 0.34, color: '#ffffff' },
      { at: 0.67, color: '#e100ff' },
    ]),
  },
  bug: {
    count: 20,
    life: [0.7, 0.9],
    speed: [20, 25],
    drag: 10,
    size: 0.15,
    wander: true,
  },
  rock: {
    life: [0.5, 0.7],
    speed: [8, 12],
    accel: [0, -30, 0],
    drag: 2,
    size: 0.3,
    upward: true,
  },
  ghost: {
    life: [0.7, 0.9],
    accel: [0, 6, 0],
    size: 0.3,
    tint: compileGradient([
      { at: 0, color: '#ffffff' },
      { at: 0.67, color: '#3d1662' },
    ]),
  },
  dragon: {
    count: 15,
    size: 0.3,
    hit: 'dragon',
    tint: compileGradient([
      { at: 0, color: '#001bff' },
      { at: 0.28, color: '#6561af' },
      { at: 0.5, color: '#ffffff' },
      { at: 1, color: '#d01111' },
    ]),
  },
  dark: {
    count: 12,
    size: 0.4,
    tint: compileGradient([
      { at: 0.28, color: '#523363' },
      { at: 0.5, color: '#ffffff' },
    ]),
  },
  fairy: {
    count: 15,
    life: [0.3, 0.6],
    accel: [0, -3, 0],
    tint: compileGradient([
      { at: 0.11, color: '#ffffff' },
      { at: 0.21, color: '#ff76ff' },
      { at: 0.39, color: '#ff3fa7' },
      { at: 0.5, color: '#f6b1ff' },
      { at: 0.57, color: '#ffffff' },
      { at: 0.65, color: '#ffaecf' },
    ]),
  },
  steel: {
    count: 12,
    life: [0.5, 0.7],
    speed: [8, 12],
    accel: [0, -30, 0],
    drag: 2,
    size: 0.3,
    upward: true,
    tint: compileGradient([{ at: 0, color: '#9c9c9c' }]),
    // `impact_steel.png` tem 2 colunas de 8 px e o original usa a da direita
    columns: 2,
    column: 1,
  },
}

// Clarão: o genérico (`hit.particle.json`) e os de dragão/veneno
// (`hit_dragon`/`hit_poison.particle.json`: mais longos, colorido, sem esticar
// os quadros pela vida — tocam a 24 fps e seguram no último).
const HIT = {
  default: {
    life: 0.2,
    frames: { first: 0, count: 5, step: 1, stretch: true },
    tint: WHITE,
  },
  dragon: {
    life: 0.5,
    frames: { first: 0, count: 5, step: 1, fps: 24 },
    tint: compileGradient([
      { at: 0.03, color: '#6a2de2' },
      { at: 0.12, color: '#ea597a' },
      { at: 0.2, color: '#ff2e48' },
      { at: 0.25, color: '#61355d' },
    ]),
  },
  poison: {
    life: 0.5,
    frames: { first: 0, count: 5, step: 1, fps: 24 },
    tint: compileGradient([
      { at: 0, color: '#724597' },
      { at: 0.03, color: '#8f6bc3' },
      { at: 0.05, color: '#deabff' },
      { at: 0.08, color: '#724597' },
      { at: 0.16, color: '#724597' },
      { at: 0.18, color: '#5a3868' },
      { at: 0.2, color: '#724597' },
      { at: 0.23, color: '#5a3868' },
    ]),
  },
}

const between = ([min, max], t) => min + t * (max - min)

/** Caminhos das 2 texturas do impacto do tipo (chaves: `hit` e `impact`). */
export function impactTexturePaths(type) {
  return {
    hit: '/assets/effects/impact/hit.png',
    impact: `/assets/effects/impact/impact_${resolveImpactType(type)}.png`,
  }
}

/** Os 2 emissores (clarão + faíscas) do impacto do tipo. */
export function buildImpactEmitters(type) {
  const resolved = resolveImpactType(type)
  const cfg = { ...DEFAULTS, ...TYPES[resolved] }
  const hit = HIT[cfg.hit ?? 'default']

  return [
    {
      id: 'hit',
      texture: 'hit',
      strip: 5,
      vertical: true,
      frames: hit.frames,
      blending: 'normal',
      start: 0,
      burst: 1,
      anchor: 'impact',
      direction: () => [0, 0, 1],
      speed: () => 0,
      accel: () => [0, 0, 0],
      drag: () => 0,
      lifetime: () => hit.life,
      size: () => 1,
      spin: false,
      tint: hit.tint,
    },
    {
      id: 'impact',
      texture: 'impact',
      strip: 7,
      vertical: true,
      columns: cfg.columns,
      column: cfg.column,
      frames: { first: 0, count: 7, step: 1, stretch: true },
      blending: 'normal',
      start: 0,
      burst: cfg.count,
      anchor: 'impact',
      // `upward` (pedra/aço): jorra pra cima; o resto sai pra todo lado
      direction: (ctx, rnd) => [
        rnd[4] * 2 - 1,
        cfg.upward ? 1 : rnd[5] * 2 - 1,
        rnd[6] * 2 - 1,
      ],
      speed: (ctx, rnd) =>
        between(cfg.speed, rnd[7]) * SPEED_FACTOR * ctx.scale,
      accel: (ctx, rnd) => {
        const k = SPEED_FACTOR * ctx.scale
        if (cfg.wander) {
          // aceleração aleatória (±50 em x/z, -50..75 em y) × ~0.5 de média
          return [
            (rnd[0] * 2 - 1) * 25 * k,
            (rnd[1] * 125 - 50) * 0.5 * k,
            (rnd[2] * 2 - 1) * 25 * k,
          ]
        }
        return [cfg.accel[0] * k, cfg.accel[1] * k, cfg.accel[2] * k]
      },
      drag: () => cfg.drag,
      lifetime: (ctx, rnd) => between(cfg.life, rnd[8]),
      size: (t) => cfg.size * sampleCurve(SIZE_OVER_LIFE, t),
      // `math.random(0, 360)`: giro qualquer, em quartos de volta
      spin: (rnd) => rnd[9] * 4,
      tint: cfg.tint,
    },
  ]
}
