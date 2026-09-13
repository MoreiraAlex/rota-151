/**
 * Molde de uma espécie. Copia esta pasta inteira pra `<dexNumber>-<id>/`
 * (ex.: `001-bulbasaur/`) — um `index.js` com os dados abaixo, mais uma pasta
 * `clips/` com um .json por ação (`idle.json`, `walk.json`, `run.json`, ...).
 * Ver `../fox/` como exemplo completo e funcional.
 *
 * `stats` e `moves` ainda não têm formato fechado — o sistema de batalha
 * ainda não foi desenhado. Preenche do jeito que fizer sentido por enquanto;
 * formalizamos o formato de verdade quando desenharmos batalha, sem precisar
 * migrar nada — são só objetos.
 */
// import IDLE_CLIP from './clips/idle.json'
// import WALK_CLIP from './clips/walk.json'

export const SPECIES_TEMPLATE = {
  id: 'nome-em-minusculo',
  dexNumber: 0,
  model: {
    path: '/assets/models/nome.glb',
    scale: 1,
  },
  clips: {
    // idle: IDLE_CLIP,
    // walk: WALK_CLIP,
  },
  stats: {},
  moves: [],
}
