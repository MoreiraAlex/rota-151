/**
 * Recuou — o recuo do Bite (docs/features/061-revisao-das-skills.md, a linha
 * "Recuo" da tabela de condições): INTERROMPE na hora (`interrupt`) — o alvo
 * para o que estava fazendo e fica atordoado como no golpe interrompido (a
 * animação de hit, pela duração da espécie). Não fica na lista de condições
 * (não tem tempo, selo nem visual no corpo); só a linha no log. Ver
 * `../_template/index.js`.
 */
export const FLINCH_CONDITION = {
  id: 'flinch',
  label: 'Recuou',
  verb: 'fazer recuar',
  duration: 0,
  tick: null,
  modifiers: {},
  interrupt: true,
  immuneTypes: [],
  keepsInBall: false,
  captureBonus: 1,
  ai: { value: 15 },
  feedback: {
    color: null,
    badge: false,
    applied: '{alvo} recuou!',
    tick: null,
  },
  visual: { tick: null, body: null },
}
