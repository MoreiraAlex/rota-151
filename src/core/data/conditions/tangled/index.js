/**
 * Enredado — a teia do String Shot (docs/features/061-revisao-das-skills.md):
 * sem tick, só freia o passo (andar, correr e voar) enquanto dura, com a teia
 * no corpo. Não acumula: de novo, renova o tempo. A Velocidade do golpe (o
 * tempo dos golpes) é o estágio, à parte. Ver `../_template/index.js`.
 */
export const TANGLED_CONDITION = {
  id: 'tangled',
  label: 'Enredado',
  verb: 'enredar',
  duration: 15,
  tick: null,
  modifiers: { movement: 0.5 },
  immuneTypes: [],
  keepsInBall: false,
  captureBonus: 1,
  ai: { value: 25 },
  feedback: {
    color: null,
    badge: true,
    applied: '{alvo} ficou enredado na teia!',
    tick: null,
  },
  visual: { tick: null, body: 'string-shot' },
}
