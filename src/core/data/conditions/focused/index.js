/**
 * Focado — a energia do Focus Energy (docs/features/061-revisao-das-skills.md,
 * Rattata): condição BOA em quem usa, sem tick, que multiplica a chance de
 * crítico dos golpes dele enquanto dura (o +2 estágios das gerações 2 a 5,
 * sobre a mesma base de crítico do jogo). Não acumula: de novo, renova o
 * tempo. Faíscas no corpo enquanto dura. Ver `../_template/index.js`.
 */
export const FOCUSED_CONDITION = {
  id: 'focused',
  label: 'Focado',
  verb: 'focar',
  duration: 15,
  tick: null,
  modifiers: { critical: 4 },
  immuneTypes: [],
  beneficial: true,
  keepsInBall: false,
  captureBonus: 1,
  ai: { value: 30 },
  feedback: {
    color: '#ff7a3d',
    badge: true,
    applied: '{alvo} está concentrado!',
    tick: null,
  },
  visual: { tick: null, body: 'focus' },
}
