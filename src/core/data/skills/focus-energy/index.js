/**
 * Energia Focada (Focus Energy) — golpe de status em SI MESMO, ver
 * `../_template/index.js` pro que cada campo significa
 * (docs/features/061-revisao-das-skills.md, Rattata).
 *
 * Como na série, aumenta a chance de crítico de quem usa: aplica nele a
 * condição FOCADO (`core/data/conditions/focused/`), que multiplica a chance
 * de crítico dos golpes dele enquanto dura e não acumula (de novo, renova o
 * tempo). Como todo golpe em si mesmo, é carregado: levar dano antes do
 * efeito interrompe.
 *
 * O Cobblemon não tem o golpe: no uso, o "atributo subiu" avermelhado
 * (`effectGroup`, `view/vfx/focusVfx.js`); enquanto estiver Focado, faíscas
 * no corpo (o `visual.body` da condição). Som do "atributo subiu".
 */
export const FOCUS_ENERGY_SKILL = {
  id: 'focus-energy',
  description:
    'Concentra a energia e fica focado por {effects.0.duration:s}: a chance de golpe crítico fica {effects.0.modifiers.critical}× maior. Usar de novo renova o tempo, sem acumular. Levar dano durante a concentração interrompe o golpe.',
  type: 'normal',
  group: 'self',
  duration: 1.25,
  effectAt: 1,
  damage: null,
  effects: [{ type: 'condition', condition: 'focused' }],
  visual: {
    effectGroup: 'focus-energy',
    effectVisualDuration: 1,
    scale: 0.6,
    revealDuration: 0,
    rotationOffset: { x: 0, y: 0, z: 0 },
    positionOffset: { x: 0, y: 0, z: 0 },
  },
  audio: { group: 'statup' },
  animation: { clipKey: 'roar' },
}
