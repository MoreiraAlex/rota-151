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
  body: {
    // Cápsula de colisão: altura total = 2 * (capsuleRadius + capsuleHalfHeight).
    capsuleRadius: 0.5,
    capsuleHalfHeight: 0.01,
    // 'y' = em pé (humanoide); 'x'/'z' deitam a cápsula pra corpo alongado
    // na horizontal (quadrúpede) — o corpo físico gira com Rotation.y, então
    // a cápsula deitada acompanha a frente da criatura ao virar.
    capsuleAxis: 'y',
    // Onde o model é renderizado em relação ao centro da cápsula (offset
    // local, em unidades de mundo — não escala com `model.scale`). Ajusta
    // junto toda vez que capsuleRadius/capsuleHalfHeight/capsuleAxis mudam.
    modelOffset: [0, 0, 0],
  },
  movement: {
    // Unidades por segundo (1 unidade = 1 metro).
    walkSpeed: 3,
    runSpeed: 7,
    // Fator de suavização do giro em direção ao movimento (rad/s aprox.).
    turnSpeed: 10,
    // Velocidade vertical inicial do pulo (m/s).
    jumpSpeed: 9,
  },
  // Opcional — sem isso, o spawn usa os defaults do trait Vitals (100/100,
  // regen 2%/10%). Só declare se esta criatura precisar de números próprios.
  vitals: {
    maxHp: 100,
    // % do máximo regenerado por segundo (enquanto não está no delay pós-dano).
    hpRegenPercent: 2,
    maxStamina: 100,
    staminaRegenPercent: 10,
  },
  stats: {},
  moves: [],
}
