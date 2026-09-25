/**
 * Redemoinho — skill do Squirtle, ver `../vine-whip/index.js` pro
 * contexto completo da rodada (docs/features/025-ataque-comum-de-
 * criatura.md, "9ª rodada") e `../_template/index.js` pro que cada campo
 * significa. Reservada pro slot `secondary1` (tecla Q) — ver
 * `core/data/species/007-squirtle/index.js`.
 *
 * Visual de verdade (`EffCommonWhirlwindL`, rip convertido — ver
 * `WhirlpoolAttackEffect.jsx`): uma coluna girando (formato de tornado no
 * rip original), radialmente simétrica no plano XZ — escolhida em vez de
 * `EffCommonIce` (a opção mais "aquática" à primeira vista) porque o
 * `.mtl` de origem do Ice referencia uma textura QUEBRADA (`map_Kd
 * .png`, arquivo inexistente, ~26% das faces da malha) — teria quebrado
 * a conversão `obj2gltf` ou perdido um quarto da malha silenciosamente.
 * `EffCommonWhirlwindL` não tem esse problema (as duas texturas
 * referenciadas existem) e o formato de vórtice combina com "Redemoinho"
 * tingido de azul, mesma técnica de tingir uma malha em escala de cinza
 * já usada em `PunchAttackEffect.jsx`.
 *
 * `range`/`radius` — área mais ampla que as outras skills (o redemoinho
 * é uma ÁREA que prende o alvo, não um golpe pontual/de alcance como
 * chicote/brasa). `staminaCost`/`cooldown` na mesma faixa. Valores de
 * PARTIDA, sem validação em jogo (sandbox sem navegador nesta sessão).
 */
export const WHIRLPOOL_ATTACK = {
  id: 'whirlpool',
  duration: 0.6,
  effectAt: 0.3,
  range: 1.6,
  aim: 'ranged',
  castMode: 'confirm',
  radius: 0.5,
  staminaCost: 4,
  cooldown: 2,
  visual: {
    effectGroup: 'whirlpool',
    effectVisualDuration: 0.45,
    scale: 1,
    revealDuration: 0,
    rotationOffset: { x: 0, y: 0, z: 0 },
  },
  sprite: {
    path: '/assets/sprites/abilities/whirlpool.png',
    scale: 1,
  },
  // Som ainda não definido — ver comentário completo em
  // `../vine-whip/index.js`.
  audio: {
    group: null,
  },
  animation: {
    clipKey: 'attack',
  },
  // Especial, poder 35 — mesmo valor clássico de "Whirlpool" nos jogos
  // originais. Ver comentário sobre `type: null` em `../scratch/index.js`.
  damage: { power: 35, category: 'special', type: null },
}
