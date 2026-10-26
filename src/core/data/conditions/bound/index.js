/**
 * Preso — o Wrap (docs/features/061-revisao-das-skills.md): o alvo não sai
 * do lugar enquanto dura (andar, correr, voar, dash e arrancada — o passo
 * zerado), mas pode girar e atacar, e perde HP aos poucos (o HP some, não
 * cura quem prendeu). Acaba só pelo tempo (decisão do usuário). Não acumula:
 * de novo, renova o tempo. Ver `../_template/index.js`.
 */
export const BOUND_CONDITION = {
  id: 'bound',
  label: 'Preso',
  verb: 'prender',
  duration: 8,
  tick: { fraction: 1 / 16, interval: 2, to: null },
  modifiers: { movement: 0 },
  immuneTypes: [],
  keepsInBall: false,
  captureBonus: 1,
  ai: { value: 35 },
  feedback: {
    color: null,
    badge: true,
    applied: '{alvo} foi preso!',
    tick: '{alvo} sofre preso ({hp} de HP)!',
  },
  visual: { tick: null, body: 'wrap' },
}
