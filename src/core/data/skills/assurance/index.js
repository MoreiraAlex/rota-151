/**
 * Garantia (Assurance) — golpe físico corpo a corpo, ver
 * `../_template/index.js` pro que cada campo significa. Entrou na 059 com
 * valores padrão: forma e VFX do `../scratch`, som de impacto; o refino fica
 * pra 090. Na série o poder dobra se o alvo já apanhou no mesmo turno — fica
 * de fora (o jogo não tem turno). Tipo Normal, como o `../bite`: a tabela de
 * tipos do jogo é a da Gen 1, sem Sombrio (`core/data/types/index.js`).
 */
export const ASSURANCE_SKILL = {
  id: 'assurance',
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
  // Físico, poder de referência: o de "Assurance" nos jogos originais.
  damage: { power: 60, category: 'physical' },
}
