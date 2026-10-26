/**
 * Queimadura (docs/features/039-tipos-e-combate-classico.md, Parte 4): tick
 * que some com o HP e corta o Ataque físico. Ver `../_template/index.js`.
 */
export const BURN_CONDITION = {
  id: 'burn',
  label: 'Queimado',
  verb: 'queimar',
  duration: 8,
  tick: { fraction: 1 / 16, interval: 2, to: null },
  modifiers: { attack: 0.5 },
  immuneTypes: ['fire'],
  keepsInBall: true,
  captureBonus: 1.5,
  ai: { value: 40 },
  feedback: {
    color: '#e8590c',
    badge: true,
    applied: '{alvo} foi queimado!',
    tick: '{alvo} sofre com a queimadura ({hp} de HP)!',
  },
  visual: { tick: null, body: 'burn' },
}
