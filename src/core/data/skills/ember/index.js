/**
 * Brasa — skill do Charmander, ver `../vine-whip/index.js` pro contexto
 * completo da rodada (docs/features/025-ataque-comum-de-criatura.md, "9ª
 * rodada") e `../_template/index.js` pro que cada campo significa.
 * Reservada pro slot `secondary1` (tecla Q) — ver `core/data/species/004-
 * charmander/index.js`.
 *
 * Visual de verdade (`EffCommonHitFire`, rip convertido — ver
 * `EmberAttackEffect.jsx`): malha plana (Z quase zero, mesmo formato de
 * "cartão" da `HitCut` — sem profundidade pra "atravessar parede"), já
 * com as próprias cores de fogo na textura (`eff_cmn_hit_fire.png`) — sem
 * precisar tingir por cima como os outros grupos (`HIT_COLOR` neutro,
 * branco, deixa a cor original da textura aparecer).
 *
 * `range` bem maior que o das demais skills — Brasa é ataque à
 * DISTÂNCIA no jogo original (bafo de fogo), não corpo-a-corpo como
 * chicote/redemoinho.
 *
 * `staminaCost`/`cooldown` saem da fórmula (`core/battle/actionCost.js`,
 * docs/features/035-balanceamento-de-acoes-e-correcoes.md) — escrever aqui só pra fugir
 * dela.
 */
export const EMBER_SKILL = {
  id: 'ember',
  description:
    'Cospe uma brasa no primeiro inimigo à frente, até {range:m}, causando dano especial de poder {power}. Tem {effects.0.chance:%} de chance de queimar: o alvo perde {effects.0.tick.fraction:%} da vida máxima a cada {effects.0.tick.interval:s} e o Ataque físico dele cai pra {effects.0.modifiers.attack:%}, por {effects.0.duration:s}. Não pega em Pokémon do tipo Fogo.',
  type: 'fire',
  group: 'ranged',
  duration: 1.2,
  effectAt: 0.95,
  visual: {
    effectGroup: 'ember',
    effectVisualDuration: 2,
    scale: 1,
    revealDuration: 0,
    rotationOffset: { x: 0, y: 0, z: 0 },
    positionOffset: { x: 0, y: 0, z: 0 },
  },
  sprite: {
    path: '/assets/sprites/abilities/ember.png',
    scale: 1,
  },
  // Som do atacante + som do alvo (grupo composto, ver `core/data/audio/
  // attackSound.js`) — do Cobblemon, cada golpe com os seus.
  audio: {
    group: 'ember',
  },
  animation: {
    clipKey: 'attackRangedAlt',
  },
  // Especial, poder de referência: o de "Ember" nos jogos originais.
  damage: { power: 40, category: 'special' },
  // Chance de queimar (regra clássica do golpe) — a queimadura é
  // `core/data/conditions/burn/`.
  effects: [{ type: 'condition', condition: 'burn', chance: 0.1 }],
}
