/**
 * Lufada de Vento (Gust) — golpe especial à distância, num alvo, ver
 * `../_template/index.js` pro que cada campo significa
 * (docs/features/061-revisao-das-skills.md, Pidgey).
 *
 * VFX e som do Gust do Cobblemon (`view/vfx/gustVfx.js`): as lufadas
 * correndo até o alvo e, quando chegam, o sopro e o redemoinho nele; o som
 * do vento saindo e batendo (`audio.group: 'gust'`).
 */
export const GUST_SKILL = {
  id: 'gust',
  description:
    'Bate as asas e lança uma lufada de vento no primeiro inimigo à frente, até {range:m}, causando dano especial de poder {power}.',
  type: 'flying',
  group: 'ranged',
  duration: 1.2,
  effectAt: 0.5,
  visual: {
    effectGroup: 'gust',
    // as lufadas e, quando chegam, o sopro e o redemoinho (`view/vfx/gustVfx.js`)
    effectVisualDuration: 1.1,
    scale: 1,
    revealDuration: 0,
    rotationOffset: { x: 0, y: 0, z: 0 },
    positionOffset: { x: 0, y: 0, z: 0 },
  },
  audio: { group: 'gust' },
  animation: { clipKey: 'attackRanged' },
  // Especial, poder de referência: o de "Gust" nos jogos originais.
  damage: { power: 40, category: 'special' },
}
