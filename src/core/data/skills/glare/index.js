/**
 * Olhar Paralisante (Glare) — golpe de status em cone, no formato do
 * `../string-shot`, ver `../_template/index.js` pro que cada campo
 * significa. Entrou na 059 com valores padrão: forma e VFX do Growl, som do
 * impacto do tipo; o refino fica pra 090. Na série ele paralisa o alvo, mas
 * o jogo ainda não tem paralisia: por enquanto não tem efeito.
 */
export const GLARE_SKILL = {
  id: 'glare',
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
