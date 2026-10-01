export const RAZOR_LEAF_SKILL = {
  id: 'razor-leaf',
  duration: 1,
  effectAt: 0.25,
  range: 3,
  aim: 'ranged',
  castMode: 'instant',
  radius: 0.4,
  staminaCost: 2,
  cooldown: 2,
  // Canalizado: dano em toda a área do cone a cada `damageInterval` s,
  // do `effectAt` até o fim; segurar o botão até o fim, soltar cancela
  // (ver `core/battle/channelAttack.js`). Intervalo de partida — a definir.
  damageMode: 'channel',
  damageInterval: 0.25,
  visual: {
    effectGroup: 'punch',
    effectVisualDuration: 0.35,
    scale: 1,
    revealDuration: 0,
    rotationOffset: { x: 0, y: 0, z: 0 },
    positionOffset: { x: 0, y: 0, z: 0 },
  },
  sprite: {
    path: '/assets/sprites/abilities/razor-leaf.png',
    scale: 1,
  },
  // Som ainda não definido — ver comentário completo em
  // `../vine-whip/index.js`.
  audio: {
    group: 'punch',
  },
  animation: {
    clipKey: 'attackRanged',
  },
  // Físico, poder 55 — mesmo valor de "Razor Leaf" nos jogos originais
  // (golpe físico apesar do tipo Grass). Ver comentário sobre `type:
  // null` em `../tackle/index.js`.
  damage: { power: 55, category: 'physical', type: null },
}
