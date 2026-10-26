/**
 * Arranhão — ver `../_template/index.js` pro que cada campo significa e
 * docs/features/025-ataque-comum-de-criatura.md pro histórico. Visual de
 * verdade (`EffCommontackle`, rip convertido — ver `tackleAttackEffect.jsx`),
 * som compartilhado com `../punch` (`audio.group: 'punch'` — só existe um
 * pacote de áudio de ataque hoje, os dois apontam pro mesmo).
 */
export const TACKLE_SKILL = {
  id: 'tackle',
  description:
    'Avança o corpo contra o primeiro inimigo à frente, até {range:m}, causando dano físico de poder {power}.',
  type: 'normal',
  group: 'melee',
  duration: 1.2,
  effectAt: 0.5,
  visual: {
    effectGroup: 'impact',
    effectVisualDuration: 0.6,
    scale: 0.6,
    revealDuration: 0.2,
    rotationOffset: { x: 0, y: 0, z: 0 },
    positionOffset: { x: 0, y: 0, z: 0 },
  },
  sprite: {
    path: '/assets/sprites/abilities/tackle.png',
    scale: 1,
  },
  audio: { group: 'impact' },
  animation: { clipKey: 'attackAlt' },
  damage: { power: 40, category: 'physical' },
}
