/**
 * Mordida (Bite) — golpe físico corpo a corpo, ver `../_template/index.js`
 * pro que cada campo significa. Entrou na 059 com valores padrão: forma e
 * VFX do `../scratch`, som de impacto; o refino fica pra 088. A chance de
 * fazer o alvo recuar (série) fica de fora até o jogo ter esse efeito.
 * Tipo Normal, como na Gen 1: a tabela de tipos do jogo é a dela, sem
 * Sombrio (`core/data/types/index.js`).
 */
export const BITE_SKILL = {
  id: 'bite',
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
  // Físico, poder de referência: o de "Bite" nos jogos originais.
  damage: { power: 60, category: 'physical' },
}
