/**
 * Withdraw — golpe de status em SI MESMO: sobe a Defesa de quem usa em 1
 * estágio, como na série. Mesmo formato do `../growth` (`group: 'self'`), ver
 * `../_template/index.js` pro que cada campo significa. Entrou na 059 com
 * valores padrão: VFX e som do "atributo subiu" do Growth, sem carga; o
 * refino fica pra 090.
 */
export const WITHDRAW_SKILL = {
  id: 'withdraw',
  description:
    'Recolhe-se no casco: a Defesa sobe {effects.0.stages} nível por {effects.0.duration:s}. Levar dano durante a concentração interrompe o golpe.',
  type: 'water',
  group: 'self',
  duration: 1.25,
  effectAt: 1,
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
  animation: { clipKey: 'charge' },
}
