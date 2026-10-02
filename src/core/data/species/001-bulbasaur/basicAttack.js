/**
 * Ataque BÁSICO do Bulbasaur (slot `primary`, mouse) — único desta espécie,
 * não é uma habilidade do registro compartilhado (`core/data/skills/`).
 * Mesmo formato de definição de uma skill — ver
 * `core/data/skills/_template/index.js` pro que cada campo significa.
 *
 * Valores de partida herdados do que a espécie usava antes (docs/features/
 * 033-skills-de-combate-e-vfx.md): `vine-whip` com range 1, duration 0.8 e effectAt 0.4. `visual`/`audio`/`sprite` reaproveitam os assets
 * de `vine-whip` — são da view, compartilháveis; o ataque em si é deste
 * do Bulbasaur.
 *
 * `duration`/`effectAt` são a BASE — o status `speed` de cada indivíduo
 * escala os dois (`calculateAttackDurationFactor`,
 * `creatureAttackSystem.js`).
 */
export const BASIC_ATTACK = {
  id: 'bulbasaur-basic',
  duration: 0.8,
  effectAt: 0.3,
  range: 1,
  aim: 'melee',
  castMode: 'instant',
  radius: 0.3,
  staminaCost: 0.25,
  cooldown: 0,
  visual: {
    effectGroup: 'impact',
    effectVisualDuration: 0.6,
    scale: 0.6,
    revealDuration: 0.2,
    rotationOffset: { x: 0, y: 0, z: 0 },
    positionOffset: { x: 0, y: 0, z: 0 },
  },
  sprite: { path: '/assets/sprites/abilities/tackle.png', scale: 1 },
  audio: { group: 'impact' },
  animation: { clipKey: 'attackBasic' },
  damage: { power: 5, category: 'physical', type: null },
}
