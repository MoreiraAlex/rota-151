/**
 * Ataque BÁSICO do Squirtle (slot `primary`, mouse) — único desta espécie,
 * não é uma habilidade do registro compartilhado (`core/data/skills/`).
 * Mesmo formato de definição de uma skill — ver
 * `core/data/skills/_template/index.js` pro que cada campo significa.
 *
 * Valores de partida herdados do que a espécie usava antes (docs/features/
 * 033-skills-de-combate-e-vfx.md): `tackle` com range 1, duration 0.8, effectAt 0.6 e animationFrames 30. `visual`/`audio`/`sprite` reaproveitam os assets
 * de `tackle` — são da view, compartilháveis; o ataque em si é deste
 * do Squirtle.
 *
 * `duration`/`effectAt` são a BASE — o status `speed` de cada indivíduo
 * escala os dois (`calculateAttackDurationFactor`,
 * `creatureAttackSystem.js`).
 */
export const BASIC_ATTACK = {
  id: 'squirtle-basic',
  duration: 0.8,
  effectAt: 0.6,
  range: 1,
  aim: 'melee',
  castMode: 'instant',
  radius: 0.3,
  staminaCost: 0.25,
  cooldown: 0,
  // Só os 30 primeiros frames do clipe embutido `attack` (ver
  // `ActionState.animationFrames`).
  animationFrames: 30,
  visual: {
    effectGroup: 'tackle',
    effectVisualDuration: 0.6,
    scale: 1,
    revealDuration: 0.2,
    rotationOffset: { x: 0, y: 0, z: 0 },
    positionOffset: { x: 0, y: 0, z: 0 },
  },
  sprite: {
    path: '/assets/sprites/abilities/tackle.png',
    scale: 1,
  },
  audio: {
    group: 'tackle',
  },
  animation: {
    clipKey: 'attack',
  },
  damage: { power: 5, category: 'physical', type: null },
}
