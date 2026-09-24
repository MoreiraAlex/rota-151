export const RAZOR_LEAF_ATTACK = {
  id: 'razor-leaf',
  duration: 0.5,
  effectAt: 0.25,
  range: 3,
  radius: 0.4,
  staminaCost: 4,
  cooldown: 2,
  visual: {
    effectGroup: 'punch',
    effectVisualDuration: 0.35,
    scale: 1,
    revealDuration: 0,
    rotationOffset: { x: 0, y: 0, z: 0 },
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
    clipKey: 'attack',
  },
  damage: null,
}
