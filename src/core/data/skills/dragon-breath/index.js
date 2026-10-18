/**
 * Dragon Breath — golpe especial à distância, ver `../_template/index.js` pro
 * que cada campo significa. Entrou na 059 com valores padrão: VFX e som
 * emprestados da Brasa (`../ember`); o refino fica pra 090. A chance de
 * paralisar da série fica de fora até o jogo ter paralisia.
 */
export const DRAGON_BREATH_SKILL = {
  id: 'dragon-breath',
  type: 'dragon',
  duration: 0.5,
  effectAt: 0.25,
  range: 8,
  aim: 'ranged',
  castMode: 'instant',
  radius: 0.35,
  damageInterval: 0.25,
  visual: {
    effectGroup: 'ember',
    effectVisualDuration: 2,
    scale: 1,
    revealDuration: 0,
    rotationOffset: { x: 0, y: 0, z: 0 },
    positionOffset: { x: 0, y: 0, z: 0 },
  },
  audio: { group: 'ember' },
  animation: { clipKey: 'attackRangedAlt' },
  // Especial, poder de referência: o de "Dragon Breath" nos jogos originais.
  damage: { power: 60, category: 'special' },
}
