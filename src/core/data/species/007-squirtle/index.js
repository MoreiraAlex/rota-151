import IDLE_CLIP from './clips/idle.json'
import WALK_CLIP from './clips/walk.json'
import RUN_CLIP from './clips/run.json'
import CRY_CLIP from './clips/cry.json'

export const SQUIRTLE = {
  id: 'squirtle',
  dexNumber: 7,
  kind: 'pokemon',
  model: {
    path: '/assets/models/007-squirtle.glb',
    scale: 0.020,
    texture: {
      0: { path: '/assets/textures/007-squirtle/default/pm0007_00_Body1.png' },
      1: { 
        path: '/assets/textures/007-squirtle/default/pm0007_00_Eye1.png',
        flipY: false,
        center: {x: 0.5, y: 0.5},
        repeat: {x: 1, y: 1},
        rotation: 180,
        eyeStates: {
          awake: {
            open: { x: -0.5, y: 0 },
            closed: { x: -0.5, y: 0.5 },
          },
        },
        blink: { minInterval: 2, maxInterval: 6, closedDuration: 0.15 },
      },
    },
  },

  clips: {
    idle: IDLE_CLIP,
    walk: WALK_CLIP,
    run: RUN_CLIP,
    cry: CRY_CLIP
  },
  body: {
    capsuleRadius: 0.3,
    capsuleHalfHeight: 0.15,
    capsuleAxis: 'y',
    modelOffset: [0, -0.45, 0],
  },
  movement: {
    walkSpeed: 2,
    runSpeed: 6,
    turnSpeed: 10,
    jumpSpeed: 9,
  },
  vitals: {
    maxHp: 100,
    hpRegenPercent: 2,
    hpRegenDelayAfterDamage: 5,
    maxStamina: 100,
    staminaRegenPercent: 10,
    staminaRegenDelayAfterUse: 3,
    runStaminaDrainPerSecond: 2,
    jumpStaminaCost: 10,
  },
  sounds: {
    footstepGroup: 'medium',
    voice: {
      clips: [
        '/assets/audio/voices/007-squirtle/cry-01.wav',
        '/assets/audio/voices/007-squirtle/cry-02.wav',
        '/assets/audio/voices/007-squirtle/cry-03.wav',
      ],
      volume: 0.8,
      refDistance: 2,
      minInterval: 4,
      maxInterval: 32,
    },
    dashGroup: 'default',
    jumpGroup: 'default',
  },
  // Quais ataques/skills — ver docs/features/025-ataque-comum-de-
  // criatura.md e o comentário completo em `../fox/index.js`. `range`
  // sobrescrito pra 1 (menor que o `1.4` da definição base de `'punch'`)
  // — corpo pequeno do Squirtle, alcance mais curto fica proporcional.
  // `secondary1` (tecla Q, 9ª rodada) — Redemoinho (`core/data/attacks/
  // whirlpool/index.js`), sem override nenhum ainda.
  attacks: {
    primary: { id: 'punch', overrides: { range: 1 } },
    secondary1: 'whirlpool',
  },
  stats: {},
  moves: [],
}
