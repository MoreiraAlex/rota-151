/**
 * Onda de Trovão (Thunder Wave) — golpe de status de distância, um alvo, ver
 * `../_template/index.js` pro que cada campo significa
 * (docs/features/061-revisao-das-skills.md).
 *
 * Como na série, PARALISA o alvo sempre que acerta
 * (`core/data/conditions/paralysis/`, que aqui atordoa enquanto dura) e não
 * pega em tipo Terra (`immuneTypes` do golpe — a paralisia em si não tem
 * imunes).
 *
 * Visual e som do Thunder Wave do Cobblemon (`view/vfx/thunderWaveVfx.js`):
 * os anéis de pé saindo de quem usa e correndo até o alvo, e lá o anel
 * enorme, os anéis girando e as faíscas; o som da onda saindo e, quando ela
 * chega, o do alvo (o grupo composto `'thunder-wave'`).
 */
export const THUNDER_WAVE_SKILL = {
  id: 'thunder-wave',
  description:
    'Solta uma onda elétrica fraca no primeiro inimigo à frente, até {range:m}, que paralisa: ele fica parado, sem andar nem atacar, por {effects.0.duration:s}. Não afeta o tipo Terra.',
  type: 'electric',
  group: 'ranged',
  accuracy: 90,
  duration: 1.2,
  effectAt: 0.5,
  damage: null,
  immuneTypes: ['ground'],
  effects: [{ type: 'condition', condition: 'paralysis' }],
  visual: {
    effectGroup: 'thunder-wave',
    // a onda e o impacto (`view/vfx/thunderWaveVfx.js`)
    effectVisualDuration: 1.3,
    scale: 1,
    revealDuration: 0,
    rotationOffset: { x: 0, y: 0, z: 0 },
    positionOffset: { x: 0, y: 0, z: 0 },
  },
  audio: { group: 'thunder-wave' },
  animation: { clipKey: 'attackRanged' },
}
