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
 * `range` (3) bem maior que as demais skills — Brasa é ataque à
 * DISTÂNCIA no jogo original (bafo de fogo), não corpo-a-corpo como
 * chicote/redemoinho. `staminaCost`/`cooldown` na mesma faixa das outras
 * skills novas — valores de PARTIDA, sem validação em jogo (sandbox sem
 * navegador nesta sessão).
 */
export const FLAMETHROWER_SKILL = {
  id: 'flamethrower',
  duration: 0.5,
  effectAt: 0.25,
  range: 3,
  aim: 'ranged',
  castMode: 'instant',
  radius: 0.8,
  staminaCost: 4,
  cooldown: 2,
  // Canalizado: dano em toda a área do cone a cada `damageInterval` s,
  // do `effectAt` até o fim; segurar o botão até o fim, soltar cancela
  // (ver `core/battle/channelAttack.js`). Intervalo de partida — a definir.
  damageMode: 'channel',
  damageInterval: 0.25,
  visual: {
    effectGroup: 'flamethrower',
    effectVisualDuration: 2.5,
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
    group: 'flamethrower',
  },
  animation: {
    clipKey: 'attackRangedAlt',
  },
  // Especial, poder 40 — mesmo valor de "Ember" nos jogos originais.
  // Ver comentário sobre `type: null` em `../tackle/index.js`.
  damage: { power: 90, category: 'special', type: null },
}
