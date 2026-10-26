export const RAZOR_LEAF_SKILL = {
  id: 'razor-leaf',
  description:
    'Canalizado: enquanto segura, dispara uma rajada de folhas afiadas no primeiro inimigo à frente, até {range:m}. Causa dano físico de poder {power}, dividido em cortes ao longo da rajada; soltar antes encerra o golpe com menos dano.',
  type: 'grass',
  group: 'ranged',
  accuracy: 95,
  duration: 1,
  effectAt: 0.25,
  // Canalizado: dano em toda a área do cone a cada `damageInterval` s,
  // do `effectAt` até o fim; segurar o botão até o fim, soltar cancela
  // (ver `core/battle/channelAttack.js`). Intervalo de partida — a definir.
  execution: 'channel',
  damageInterval: 0.25,
  // Folhas subindo na carga, rajada cortando o cone no canal e cortes na
  // frente de cada alvo a cada tick (`view/vfx/razorLeafVfx.js`).
  visual: {
    effectGroup: 'none',
    chargeGroup: 'razor-leaf-charge',
    channelGroup: 'razor-leaf',
    channelHitGroup: 'razor-leaf-hit',
    channelHitVisualDuration: 0.7,
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
  // Os sons do Razor Leaf do Cobblemon: dois de quem usa e o do alvo (grupo
  // composto, ver `core/data/audio/attackSound.js`).
  audio: { group: 'razor-leaf' },
  animation: {
    clipKey: 'attackRanged',
  },
  // Físico, poder de referência: o de "Razor Leaf" nos jogos originais
  // (golpe físico apesar do tipo Grass).
  damage: { power: 55, category: 'physical' },
}
