/**
 * Olhar Penetrante (Leer) — golpe de status em cone que baixa a DEFESA dos
 * alvos, como o `../tail-whip`, ver `../_template/index.js` pro que cada
 * campo significa. Entrou na 059 com valores padrão: forma e VFX do
 * `../growl`, som do impacto do tipo; o refino (um olhar no lugar das ondas)
 * fica pra 088.
 */
export const LEER_SKILL = {
  id: 'leer',
  type: 'normal',
  accuracy: 100,
  duration: 1.2,
  effectAt: 0.5,
  range: 3,
  aim: 'ranged',
  castMode: 'instant',
  area: 'cone',
  // abertura do cone: `radius / range` (tangente do meio-ângulo)
  radius: 1.5,
  damage: null,
  effects: [{ type: 'statStage', stat: 'defense', stages: -1, duration: 60 }],
  visual: {
    effectGroup: 'growl',
    effectVisualDuration: 1,
    scale: 1,
    revealDuration: 0,
    rotationOffset: { x: 0, y: 0, z: 0 },
    positionOffset: { x: 0, y: 0, z: 0 },
  },
  audio: { group: 'impact' },
  animation: { clipKey: 'attackRanged' },
}
