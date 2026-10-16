/**
 * Ataque de Areia (Sand Attack) — golpe de status em cone que baixa a
 * PRECISÃO dos alvos, no formato do `../smokescreen`, ver
 * `../_template/index.js` pro que cada campo significa. Entrou na 059 com
 * valores padrão: forma, VFX e som da Cortina de Fumaça; o refino (areia no
 * lugar da fumaça) fica pra 088.
 */
export const SAND_ATTACK_SKILL = {
  id: 'sand-attack',
  type: 'ground',
  duration: 1.2,
  effectAt: 0.5,
  range: 3,
  aim: 'ranged',
  castMode: 'instant',
  area: 'cone',
  // abertura do cone: `radius / range` (tangente do meio-ângulo)
  radius: 1.5,
  accuracy: 100,
  damage: null,
  effects: [{ type: 'statStage', stat: 'accuracy', stages: -1, duration: 30 }],
  visual: {
    effectGroup: 'smokescreen',
    effectVisualDuration: 2.5,
    targetEffectGroup: 'smokescreen-target',
    targetEffectVisualDuration: 3,
    scale: 1,
    revealDuration: 0,
    rotationOffset: { x: 0, y: 0, z: 0 },
    positionOffset: { x: 0, y: 0, z: 0 },
  },
  audio: { group: 'smokescreen' },
  animation: { clipKey: 'attackRanged' },
}
