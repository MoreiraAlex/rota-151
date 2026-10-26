/**
 * Bola Elétrica (Electro Ball) — golpe especial de distância, um alvo, ver
 * `../_template/index.js` pro que cada campo significa
 * (docs/features/061-revisao-das-skills.md).
 *
 * Como na série, o PODER vem da razão entre a Velocidade de quem usa e a do
 * alvo (`damage.speedPower`, `core/battle/speedPower.js` — com o estágio de
 * Velocidade): os degraus da série; abaixo de todos, o mais fraco. A IA
 * calcula o poder contra cada alvo (`resolveAiPower`); o custo usa o `power`
 * do golpe (o do meio), porque o preço é do golpe, não de um alvo.
 *
 * O Cobblemon não tem o golpe: o visual é o Shadow Ball em amarelo
 * elétrico, com o impacto do Thunder Shock (`view/vfx/electroBallVfx.js`) —
 * carregando, a bola se formando na frente do peito; no `effectAt`, a bola
 * voando até o alvo e, quando chega, o impacto. Som: a bola saindo (Shadow
 * Ball) e o acerto (Thunderbolt), o grupo composto `'electro-ball'`.
 */
export const ELECTRO_BALL_SKILL = {
  id: 'electro-ball',
  description:
    'Arremessa uma bola elétrica no primeiro inimigo à frente, até {range:m}, causando dano especial. Quanto mais rápido que o alvo, mais forte: o poder vai de {damage.speedPower.0.power} (mais lento que ele) a {damage.speedPower.4.power} (quatro vezes mais rápido).',
  type: 'electric',
  group: 'ranged',
  duration: 2.5,
  effectAt: 0.75,
  visual: {
    effectGroup: 'electro-ball',
    // a bola e o impacto (`view/vfx/electroBallVfx.js`)
    effectVisualDuration: 1,
    chargeGroup: 'electro-ball-charge',
    scale: 1,
    revealDuration: 0,
    rotationOffset: { x: 0, y: 0, z: 0 },
    positionOffset: { x: 0, y: 0, z: 0 },
  },
  audio: { group: 'electro-ball' },
  animation: { clipKey: 'attackAlt' },
  // Especial. O poder pela razão de Velocidade (quem usa ÷ alvo), os degraus
  // da série; o `power` é o do meio (a referência do custo).
  damage: {
    power: 60,
    category: 'special',
    speedPower: [
      { ratio: 0, power: 40 },
      { ratio: 1, power: 60 },
      { ratio: 2, power: 80 },
      { ratio: 3, power: 120 },
      { ratio: 4, power: 150 },
    ],
  },
}
