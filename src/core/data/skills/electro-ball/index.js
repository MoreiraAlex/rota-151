/**
 * Bola Elétrica (Electro Ball) — golpe especial à distância, ver
 * `../_template/index.js` pro que cada campo significa. Entrou na 059 com
 * valores padrão: forma da Brasa (`../ember`), VFX e som do impacto genérico
 * do tipo (`'impact'`); o refino fica pra 088. Na série o poder cresce com a
 * Velocidade de quem usa em relação à do alvo; por enquanto é fixo, o da
 * faixa do meio.
 */
export const ELECTRO_BALL_SKILL = {
  id: 'electro-ball',
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
  // Especial, poder de referência: um dos da tabela do "Electro Ball" nos
  // jogos originais (o poder lá depende da Velocidade).
  damage: { power: 60, category: 'special' },
}
