/**
 * Arranhão (Scratch) — golpe físico corpo a corpo, ver `../_template/index.js`
 * pro que cada campo significa. Entrou na 059 com valores padrão: VFX do
 * grupo `'scratch'` e som de impacto compartilhado; o refino fica pra 090.
 */
export const SCRATCH_SKILL = {
  id: 'scratch',
  type: 'normal',
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
  animation: { clipKey: 'attackAlt' },
  // Físico, poder de referência: o de "Scratch" nos jogos originais.
  damage: { power: 40, category: 'physical' },
}
