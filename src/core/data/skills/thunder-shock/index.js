/**
 * Choque do Trovão (Thunder Shock) — golpe especial à distância, ver
 * `../_template/index.js` pro que cada campo significa. Entrou na 059 com
 * valores padrão: forma da Brasa (`../ember`), VFX e som do impacto genérico
 * do tipo (`'impact'`); o refino fica pra 088. A chance de paralisar da série
 * fica de fora até o jogo ter paralisia.
 */
export const THUNDER_SHOCK_SKILL = {
  id: 'thunder-shock',
  type: 'electric',
  duration: 0.5,
  effectAt: 0.25,
  range: 8,
  aim: 'ranged',
  castMode: 'instant',
  radius: 0.35,
  visual: {
    effectGroup: 'impact',
    effectVisualDuration: 0.6,
    scale: 0.8,
    revealDuration: 0.2,
    rotationOffset: { x: 0, y: 0, z: 0 },
    positionOffset: { x: 0, y: 0, z: 0 },
  },
  audio: { group: 'impact' },
  animation: { clipKey: 'attackRangedAlt' },
  // Especial, poder de referência: o de "Thunder Shock" nos jogos originais.
  damage: { power: 40, category: 'special' },
}
