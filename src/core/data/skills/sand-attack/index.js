/**
 * Ataque de Areia (Sand Attack) — golpe de status em cone, que baixa a
 * PRECISÃO de todos os inimigos dentro (estágio, acumula e renova), ver
 * `../_template/index.js` pro que cada campo significa
 * (docs/features/061-revisao-das-skills.md, Pidgey).
 *
 * VFX e som do Sand Attack do Cobblemon (`view/vfx/sandAttackVfx.js`): a
 * areia chutada em arco pra frente (`effectGroup`), os grãos e a poeira
 * estourando em cada alvo quando a areia chega (`targetEffectGroup`), e o
 * chute e o
 * acerto (`audio.group: 'sand-attack'`).
 */
export const SAND_ATTACK_SKILL = {
  id: 'sand-attack',
  description:
    'Chuta areia em leque à frente. Todos os inimigos dentro dele têm a Precisão reduzida em {effects.0.stages:abs} nível por {effects.0.duration:s} e passam a errar mais golpes. Usar de novo acumula a redução e renova o tempo.',
  type: 'ground',
  group: 'cone',
  duration: 1.2,
  effectAt: 0.5,
  accuracy: 100,
  // Sem dano: nada "apanha", e `attackResolved` sai com `status: true`.
  damage: null,
  effects: [{ type: 'statStage', stat: 'accuracy', stages: -1, duration: 15 }],
  visual: {
    effectGroup: 'sand-attack',
    // a areia (vida dos grãos) e a poeira (`view/vfx/sandAttackVfx.js`)
    effectVisualDuration: 1.1,
    targetEffectGroup: 'sand-attack-target',
    // a areia chegando + a vida dos grãos no alvo
    targetEffectVisualDuration: 1.4,
    scale: 1,
    revealDuration: 0,
    rotationOffset: { x: 0, y: 0, z: 0 },
    positionOffset: { x: 0, y: 0, z: 0 },
  },
  audio: { group: 'sand-attack' },
  animation: { clipKey: 'attack' },
}
