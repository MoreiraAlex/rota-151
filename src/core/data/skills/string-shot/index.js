/**
 * Estilingada de Teia (String Shot) — golpe de status em cone, no formato do
 * `../growl`, ver `../_template/index.js` pro que cada campo significa.
 * Entrou na 059 com valores padrão: forma e VFX do Growl, som do impacto do
 * tipo; o refino fica pra 088. Na série ele baixa a Velocidade do alvo, mas
 * o jogo ainda não tem estágio de Velocidade (`STAT_STAGE_KEYS`,
 * `core/battle/statStages.js`): por enquanto não tem efeito.
 */
export const STRING_SHOT_SKILL = {
  id: 'string-shot',
  type: 'bug',
  accuracy: 95,
  duration: 1.2,
  effectAt: 0.5,
  range: 3,
  aim: 'ranged',
  castMode: 'instant',
  area: 'cone',
  // abertura do cone: `radius / range` (tangente do meio-ângulo)
  radius: 1.5,
  damage: null,
  effects: [],
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
