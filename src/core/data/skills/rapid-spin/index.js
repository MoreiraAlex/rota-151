/**
 * Rapid Spin — golpe físico corpo a corpo, ver `../_template/index.js` pro
 * que cada campo significa. Entrou na 059 com valores padrão: forma, VFX e
 * som do `../tackle`; o refino fica pra 088. A subida de Velocidade de quem
 * usa (série) fica de fora até golpe com dano poder mexer no próprio
 * atributo.
 */
export const RAPID_SPIN_SKILL = {
  id: 'rapid-spin',
  type: 'normal',
  duration: 0.5,
  effectAt: 0.25,
  range: 1.4,
  aim: 'melee',
  castMode: 'instant',
  radius: 0.3,
  visual: {
    effectGroup: 'impact',
    effectVisualDuration: 0.6,
    scale: 0.6,
    revealDuration: 0.2,
    rotationOffset: { x: 0, y: 0, z: 0 },
    positionOffset: { x: 0, y: 0, z: 0 },
  },
  audio: { group: 'impact' },
  animation: { clipKey: 'attackAlt' },
  // Físico, poder de referência: o de "Rapid Spin" nos jogos originais.
  damage: { power: 50, category: 'physical' },
}
