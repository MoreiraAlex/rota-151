import { compileGradient, sampleCurve } from './particleSimulation'

/**
 * "Atributo subiu" em partículas — o boost genérico do Cobblemon, que o mod
 * toca em toda criatura que sobe atributo (`data/cobblemon/action_effects/
 * misc/boost.json`). Tradução manual de `statup_actor.particle.json` e
 * `statup_actoraura.particle.json` (`.exemple/Coblemon/assets/cobblemon/
 * bedrock/particles/generic/`). Usado pelo Growth (grupo `'statup'`).
 *
 *   - `orbs`  — orbes subindo numa espiral em volta do corpo
 *   - `aura`  — riscos verticais disparando do chão
 *
 * (os 0.1 s são o `delay` do `boost.json`; o `aura` nasce junto do `orbs`,
 * que o cria no `creation_event`)
 *
 * Espaço local: o `AttackEffect` nasce nos PÉS da criatura (`area: 'self'`),
 * a mesma origem do `root` do Bedrock. As expressões do original dependem de
 * `entity_width`/`entity_height`, presas em mínimo 1 pelos `math.clamp` — pra
 * uma criatura do tamanho das daqui, o valor do mínimo. Por isso: altura 1 e,
 * na horizontal, o raio vem do `radius` da skill (`0.7 × largura` = `1.4 ×
 * radius`, com `radius 0.5` = largura 1, igual ao original).
 *
 * `scale` (`visual.scale`) encolhe o efeito INTEIRO: o motor já multiplica
 * posição e tamanho; velocidade e aceleração são multiplicadas aqui, senão os
 * riscos subiriam a mesma altura num efeito menor. As funções trigonométricas
 * do Bedrock são em GRAUS (`deg`). O Z do Bedrock aponta pro lado oposto, mas a
 * espiral é simétrica: fica como está.
 */

export const STATUP_TEXTURE_PATHS = {
  orb: '/assets/effects/statup/xsboost.png',
}

// Altura do corpo assumida (o `entity_height` preso no mínimo, ver acima).
const BODY_HEIGHT = 1
// `0.7 × entity_width` (orbes) e `0.65 × entity_width` (riscos), com a
// largura vinda do `radius` da skill (largura = 2 × radius).
const ORB_RING = 1.4
const AURA_RING = 1.3

// `variable.shrink` de cada um (nós ao longo da vida).
const ORB_SHRINK = [0.65, 0.85, 0.97, 1, 1, 0.96, 0.85, 0.67, 0.39, 0]
const AURA_SHRINK = [0, 1, 0.73, 0.41, -0.1]

// Sem `particle_appearance_tinting`: a textura (laranja) sai como é.
const NO_TINT = compileGradient([{ at: 0, color: '#ffffff' }])

const deg = (degrees) => (degrees * Math.PI) / 180

export const STATUP_EMITTERS = [
  // statup_actor.particle.json — 30/s por 0.375 s: o ponto de emissão gira
  // em volta do corpo (x e z em frequências diferentes, então desenha uma
  // espiral irregular) e oscila na altura; cada orbe sobe e freia.
  {
    id: 'orbs',
    texture: 'orb',
    strip: 9,
    frames: { first: 0, count: 9, fps: 24 },
    blending: 'normal',
    start: 0.1,
    duration: 0.375,
    rate: () => 30,
    anchor: 'impact',
    offset: (ctx) => [
      Math.sin(deg(ctx.age * 1650)) * ctx.radius * ORB_RING,
      BODY_HEIGHT * 0.5 + Math.sin(deg(ctx.age * 3220)) * 0.6,
      Math.cos(deg(ctx.age * 2670)) * ctx.radius * ORB_RING,
    ],
    direction: () => [0, 1, 0],
    speed: (ctx) => 2 * ctx.scale,
    accel: (ctx) => [0, -1 * ctx.scale, 0],
    drag: () => 0,
    lifetime: () => 0.45,
    size: (t) => 0.1 * sampleCurve(ORB_SHRINK, t),
    spin: false,
    tint: NO_TINT,
  },
  // statup_actoraura.particle.json — 60/s por 0.3 s: riscos finos (0.02 ×
  // 0.2 m) que nascem um pouco abaixo dos pés, num anel em volta do corpo, e
  // disparam pra cima (7 a 14 m/s) freando forte. O `lookat_y` do original
  // (quadro em pé, girando só em Y) vira `facing: 'direction'` — o quadro
  // deitado ao longo do movimento, que é vertical.
  {
    id: 'aura',
    texture: 'orb',
    strip: 9,
    frames: { first: 0, count: 9, fps: 30 },
    facing: 'direction',
    blending: 'normal',
    start: 0.1,
    duration: 0.3,
    rate: () => 60,
    anchor: 'impact',
    offset: (ctx, rnd) => [
      -Math.cos(deg(rnd[0] * 360 + ctx.age * 2000)) * ctx.radius * AURA_RING,
      BODY_HEIGHT * 0.5 - 0.8,
      -Math.sin(deg(rnd[1] * 360 + ctx.age * 2880)) * ctx.radius * AURA_RING,
    ],
    direction: () => [0, 1, 0],
    speed: (ctx, rnd) => (rnd[3] + 1) * 7 * ctx.scale,
    accel: (ctx, rnd) => [0, -(rnd[3] + 2.5) * 9 * ctx.scale, 0],
    drag: () => 0,
    lifetime: () => 0.33,
    // [comprimento ao longo do movimento, espessura]
    size: (t) => [0.2 * sampleCurve(AURA_SHRINK, t), 0.02],
    spin: false,
    tint: NO_TINT,
  },
]
