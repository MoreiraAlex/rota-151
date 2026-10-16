/**
 * Ataque de Fúria (Fury Attack) — golpe físico corpo a corpo, ver
 * `../_template/index.js` pro que cada campo significa. Entrou na 059 com
 * valores padrão: forma e VFX do `../scratch`, som de impacto; o refino fica
 * pra 088. Na série ele acerta de 2 a 5 vezes seguidas — por enquanto é um
 * golpe só (o jogo não tem golpe de vários acertos).
 */
export const FURY_ATTACK_SKILL = {
  id: 'fury-attack',
  type: 'normal',
  accuracy: 85,
  duration: 0.5,
  effectAt: 0.25,
  range: 1.4,
  aim: 'melee',
  castMode: 'instant',
  radius: 0.3,
  visual: {
    effectGroup: 'scratch',
    effectVisualDuration: 0.6,
    scale: 1,
    revealDuration: 0,
    rotationOffset: { x: 0, y: 0, z: 0 },
    positionOffset: { x: 0, y: 0, z: 0 },
  },
  audio: { group: 'impact' },
  animation: { clipKey: 'attack' },
  // Físico, poder de referência: o de "Fury Attack" nos jogos originais
  // (um acerto).
  damage: { power: 15, category: 'physical' },
}
