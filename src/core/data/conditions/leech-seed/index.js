/**
 * Semente do Leech Seed (docs/features/033-skills-de-combate-e-vfx.md, Parte
 * 9): tick que cura quem plantou o mesmo valor; a cada drenagem, orbes do
 * alvo até quem plantou. Ver `../_template/index.js`.
 */
export const LEECH_SEED_CONDITION = {
  id: 'leech-seed',
  label: 'Semente',
  verb: 'semear',
  duration: 6,
  tick: { fraction: 1 / 16, interval: 2, to: 'source' },
  modifiers: {},
  immuneTypes: [],
  keepsInBall: false,
  captureBonus: 1,
  ai: { value: 35 },
  feedback: {
    color: null,
    badge: false,
    applied: '{alvo} foi semeado!',
    tick: 'A semente drenou {hp} de HP de {alvo}!',
  },
  visual: {
    tick: {
      group: 'leech-drain',
      soloGroup: 'leech-drain-solo',
      duration: 1.6,
    },
  },
}
