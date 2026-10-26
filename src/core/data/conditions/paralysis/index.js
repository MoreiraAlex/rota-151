/**
 * Paralisado — o Glare (e depois o Thunder Wave), docs/features/061-revisao-
 * das-skills.md: ATORDOA enquanto dura (decisão do usuário: a paralisia é um
 * stun) — não anda, ataca, pula nem voa, o que estava fazendo é
 * interrompido, e toca a animação de atordoado da espécie. Sem imunes
 * (decisão do usuário, como na Gen 1). Fica na bola e ajuda na captura,
 * como a queimadura. Não acumula: de novo, renova o tempo. Ver
 * `../_template/index.js`.
 */
export const PARALYSIS_CONDITION = {
  id: 'paralysis',
  label: 'Paralisado',
  verb: 'paralisar',
  duration: 3,
  tick: null,
  modifiers: { movement: 0 },
  stun: true,
  immuneTypes: [],
  keepsInBall: true,
  captureBonus: 1.5,
  ai: { value: 60 },
  feedback: {
    color: '#f2c94c',
    badge: true,
    applied: '{alvo} ficou paralisado!',
    tick: null,
  },
  visual: { tick: null, body: 'paralysis' },
}
