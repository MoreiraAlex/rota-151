import IDLE_CLIP from './clips/idle.json'
import WALK_CLIP from './clips/walk.json'
import RUN_CLIP from './clips/run.json'

export const CHARMANDER = {
  id: 'charmander',
  dexNumber: 4,
  kind: 'pokemon',
  model: {
    path: '/assets/models/004-charmander.glb',
    scale: 0.015,
    texture: {
      0: { 
        path: '/assets/textures/004-charmander/default/pm0004_00_Eye1.png',
        flipY: false,
        center: {x: 0.5, y: 0.5},
        repeat: {x: 1, y: 1},
        pan: {x: -0.5, y: 0},
        rotation: 180
      },
      1: { path: '/assets/textures/004-charmander/default/pm0004_00_Body1.png' },
      3: { path: '/assets/textures/004-charmander/default/pm0004_00_FireStenA1.png' },
    },
  },

  clips: {
    idle: IDLE_CLIP,
    walk: WALK_CLIP,
    run: RUN_CLIP,
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
        '/assets/audio/voices/004-charmander/cry-01.wav',
        '/assets/audio/voices/004-charmander/cry-02.wav',
        '/assets/audio/voices/004-charmander/cry-03.wav',
      ],
      volume: 0.8,
      refDistance: 2,
      minInterval: 4,
      maxInterval: 32,
    },
    dashGroup: 'default',
    jumpGroup: 'default',
  },
  stats: {},
  moves: [],
}
