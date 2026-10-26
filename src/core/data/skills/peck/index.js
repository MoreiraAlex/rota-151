/**
 * Bicada (Peck) — golpe físico corpo a corpo, ver `../_template/index.js`
 * pro que cada campo significa (docs/features/061-revisao-das-skills.md).
 *
 * O Cobblemon não tem o golpe: VFX e som são os do acerto do Aerial Ace, sem
 * o pulo de quem usa (`view/vfx/peckVfx.js`) — os dois cortes cruzados e o
 * estouro de faíscas no alvo, e o som do corte batendo.
 */
export const PECK_SKILL = {
  id: 'peck',
  description:
    'Bica o primeiro inimigo à frente, até {range:m}, causando dano físico de poder {power}.',
  type: 'flying',
  group: 'melee',
  duration: 1.2,
  effectAt: 0.5,
  visual: {
    effectGroup: 'peck',
    // os cortes e o estouro (`view/vfx/peckVfx.js`)
    effectVisualDuration: 0.65,
    scale: 0.5,
    revealDuration: 0,
    rotationOffset: { x: 0, y: 0, z: 0 },
    positionOffset: { x: 0, y: 0, z: 0 },
  },
  audio: { group: 'peck-target' },
  animation: { clipKey: 'attack' },
  // Físico, poder de referência: o de "Peck" nos jogos originais.
  damage: { power: 35, category: 'physical' },
}
