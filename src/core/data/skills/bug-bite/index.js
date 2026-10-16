/**
 * Picada (Bug Bite) — golpe físico corpo a corpo, ver `../_template/index.js`
 * pro que cada campo significa. Entrou na 059 com valores padrão: forma e
 * VFX do `../scratch`, som do impacto do tipo; o refino fica pra 088. Comer a
 * fruta do alvo (série) fica de fora.
 */
export const BUG_BITE_SKILL = {
  id: 'bug-bite',
  type: 'bug',
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
  // Físico, poder de referência: o de "Bug Bite" nos jogos originais.
  damage: { power: 60, category: 'physical' },
}
