/**
 * Olhar Paralisante (Glare) — golpe de status de distância, um alvo, ver
 * `../_template/index.js` pro que cada campo significa
 * (docs/features/061-revisao-das-skills.md).
 *
 * Como na série, paralisa o alvo: a condição PARALISADO
 * (`core/data/conditions/paralysis/`), que aqui ATORDOA enquanto dura — não
 * anda, ataca, pula nem voa (decisão do usuário: a paralisia é um stun).
 *
 * O Cobblemon não tem o golpe: é o Scary Face — o brilho nos olhos de quem
 * usa (`visual.actionGroup: 'glare'`; o meio dos olhos é o
 * `visual.positionOffset`, como no Leer) e, no alvo, o rosto assustador e as faíscas da paralisia pegando
 * (`targetEffectGroup: 'glare-target'`, `view/vfx/glareVfx.js`). Som: o do
 * Scary Face e o da paralisia (o grupo composto `'glare'`).
 */
export const GLARE_SKILL = {
  id: 'glare',
  description:
    'Encara o primeiro inimigo à frente, até {range:m}, com um olhar que paralisa: ele fica parado, sem andar nem atacar, por {effects.0.duration:s}.',
  type: 'normal',
  group: 'ranged',
  accuracy: 100,
  duration: 1.2,
  effectAt: 0.5,
  damage: null,
  effects: [{ type: 'condition', condition: 'paralysis' }],
  visual: {
    // sem visual de impacto: o brilho é da AÇÃO e o resto nasce no alvo
    effectGroup: 'none',
    effectVisualDuration: 0,
    actionGroup: 'glare',
    targetEffectGroup: 'glare-target',
    // o rosto e as faíscas (`view/vfx/glareVfx.js`)
    targetEffectVisualDuration: 1.4,
    scale: 1,
    revealDuration: 0,
    rotationOffset: { x: 0, y: 0, z: 0 },
    positionOffset: { x: 0, y: 0.15, z: 0.1 },
  },
  audio: { group: 'glare' },
  animation: { clipKey: 'attackRanged' },
}
