/**
 * Rapid Spin — golpe físico corpo a corpo, ver `../_template/index.js` pro
 * que cada campo significa. A criatura se recolhe e gira como pião: a
 * animação é da espécie (o Squirtle tem um clipe procedural próprio,
 * `species/007-squirtle/clips/rapid-spin.json`); o vento girando e a poeira
 * (`view/vfx/rapidSpinVfx.js`) e o som do vento rodam do `effectAt` até o
 * fim da ação (`actionGroup`), e o acerto tem o impacto do tipo.
 * Como na série, quando acerta sobe a VELOCIDADE de quem usa e o solta do Wrap
 * e da semente do Leech Seed (`selfEffects`).
 */
export const RAPID_SPIN_SKILL = {
  id: 'rapid-spin',
  description:
    'Gira o casco em alta velocidade e acerta todos os inimigos em volta, até {range:m} do corpo, com dano físico de poder {power}. Acertando alguém, a Velocidade de quem usa sobe {selfEffects.0.stages} nível por {selfEffects.0.duration:s}, e ele se solta se estiver preso ou com a semente.',
  type: 'normal',
  // Em volta de quem usa (teste do grupo `'circle'`, pedido do usuário: na
  // série é um alvo só, com contato).
  group: 'circle',
  duration: 2,
  effectAt: 0.75,
  visual: {
    effectGroup: 'impact',
    effectVisualDuration: 0.6,
    scale: 0.6,
    revealDuration: 0.2,
    rotationOffset: { x: 0, y: 0, z: 0 },
    positionOffset: { x: 0, y: 0, z: 0 },
    actionGroup: 'rapid-spin',
  },
  audio: {
    group: 'impact',
    actionGroup: 'gust-actor',
  },
  animation: { clipKey: 'spin' },
  // Físico, poder de referência: o de "Rapid Spin" nos jogos originais.
  damage: { power: 50, category: 'physical' },
  // o que dá a quem usa quando acerta: Velocidade +1 e se soltar do Wrap e da
  // semente (a série)
  selfEffects: [
    { type: 'statStage', stat: 'speed', stages: 1, duration: 15 },
    { type: 'removeConditions', conditions: ['bound', 'leech-seed'] },
  ],
}
