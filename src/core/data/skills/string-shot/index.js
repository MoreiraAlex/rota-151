/**
 * Estilingada de Teia (String Shot) — golpe de status em cone, no formato do
 * `../growl`, ver `../_template/index.js` pro que cada campo significa
 * (docs/features/061-revisao-das-skills.md).
 *
 * Dois efeitos em todos os inimigos no cone (decisão do usuário):
 * - a VELOCIDADE cai, como na série: estágio que deixa os golpes mais lentos
 *   (`core/battle/statStages.js`); acumula e renova como os outros estágios;
 * - a condição ENREDADO (`core/data/conditions/tangled/`): o passo de andar,
 *   correr e voar mais curto, com a teia no corpo enquanto dura; não
 *   acumula, renova.
 *
 * Visual e som do Cobblemon (`view/vfx/stringShotVfx.js`): os fios saindo da
 * boca no leque do cone (`effectGroup`), os fios e a teia enrolando cada
 * alvo atingido (`targetEffectGroup`), e o disparo e a teia grudando
 * (`audio.group: 'string-shot'`).
 */
export const STRING_SHOT_SKILL = {
  id: 'string-shot',
  description:
    'Dispara fios de seda em leque à frente. Todos os inimigos dentro dele têm a Velocidade reduzida em {effects.0.stages:abs} níveis por {effects.0.duration:s}, e os golpes deles demoram mais — usar de novo acumula a redução. Além disso ficam enredados na teia por {effects.1.duration:s}, andando a {effects.1.modifiers.movement:%} do passo normal.',
  type: 'bug',
  group: 'cone',
  accuracy: 95,
  duration: 1.2,
  effectAt: 0.5,
  // Sem dano: nada "apanha", e `attackResolved` sai com `status: true`.
  damage: null,
  effects: [
    { type: 'statStage', stat: 'speed', stages: -2, duration: 15 },
    { type: 'condition', condition: 'tangled' },
  ],
  visual: {
    effectGroup: 'string-shot',
    // os fios: emissão + vida (`view/vfx/stringShotVfx.js`)
    effectVisualDuration: 1,
    targetEffectGroup: 'string-shot-target',
    // a pausa + a teia enrolando + vida das partículas
    targetEffectVisualDuration: 1.5,
    scale: 1,
    revealDuration: 0,
    rotationOffset: { x: 0, y: 0, z: 0 },
    positionOffset: { x: 0, y: 0, z: 0 },
  },
  audio: { group: 'string-shot' },
  animation: { clipKey: 'attackRanged' },
}
