/**
 * Withdraw — golpe de status em SI MESMO: sobe a Defesa de quem usa em 1
 * estágio, como na série. Mesmo formato do `../growth` (`area: 'self'`), ver
 * `../_template/index.js` pro que cada campo significa. Entrou na 059 com
 * valores padrão: VFX e som do "atributo subiu" do Growth, sem carga; o
 * refino fica pra 088.
 */
export const WITHDRAW_SKILL = {
  id: 'withdraw',
  type: 'water',
  duration: 1,
  effectAt: 0.5,
  range: 0,
  castMode: 'instant',
  area: 'self',
  radius: 0.5,
  // Sem dano: só sobe a defesa de quem usou.
  damage: null,
  effects: [{ type: 'statStage', stat: 'defense', stages: 1, duration: 60 }],
  visual: {
    effectGroup: 'statup',
    effectVisualDuration: 1,
    scale: 0.6,
    revealDuration: 0,
    rotationOffset: { x: 0, y: 0, z: 0 },
    positionOffset: { x: 0, y: 0, z: 0 },
  },
  audio: { group: 'statup' },
  animation: { clipKey: 'roar' },
}
