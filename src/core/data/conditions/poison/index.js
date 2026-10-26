/**
 * Envenenamento (docs/features/061-revisao-das-skills.md, Weedle): tick que
 * some com o HP, sem modificador, e continua na Pokébola — o veneno do
 * Poison Sting. Bolhas roxas no corpo enquanto dura. Ver
 * `../_template/index.js`.
 */
export const POISON_CONDITION = {
  id: 'poison',
  label: 'Envenenado',
  verb: 'envenenar',
  duration: 8,
  tick: { fraction: 1 / 16, interval: 2, to: null },
  modifiers: {},
  // a tabela de tipos é a da Gen 1 (sem Aço)
  immuneTypes: ['poison'],
  keepsInBall: true,
  captureBonus: 1.5,
  ai: { value: 30 },
  feedback: {
    color: '#a040a0',
    badge: true,
    applied: '{alvo} foi envenenado!',
    tick: '{alvo} sofre com o veneno ({hp} de HP)!',
  },
  visual: { tick: null, body: 'poison' },
}
