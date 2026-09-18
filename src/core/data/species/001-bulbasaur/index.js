import IDLE_CLIP from './clips/idle.json'
import WALK_CLIP from './clips/walk.json'
import RUN_CLIP from './clips/run.json'

export const BULBASAUR = {
  id: 'bulbasaur',
  dexNumber: 1,
  kind: 'pokemon',
  model: {
    path: '/assets/models/001-bulbasaur.glb',
    scale: 0.012,
    texture: {
      0: { path: '/assets/textures/001-bulbasaur/default/pm0001_00_BodyA1.png' },
      2: { path: '/assets/textures/001-bulbasaur/default/pm0001_00_BodyB1.png' },
      3: { 
        path: '/assets/textures/001-bulbasaur/default/pm0001_00_Eye1_Merged.png',
        flipY: false,
        center: {x: 0.5, y: 0.5},
        repeat: {x: 1/4, y: 1/4},
        pan: {x: -0.5, y: -0.25},
        rotation: 180
      },
      4: { path: '/assets/textures/001-bulbasaur/default/pm0001_00_BodyB1.png' },
      5: { path: '/assets/textures/001-bulbasaur/default/pm0001_00_BodyB1.png' },
    },
  },

  clips: {
    idle: IDLE_CLIP,
    walk: WALK_CLIP,
    run: RUN_CLIP,
  },
  body: {
    capsuleRadius: 0.4,
    capsuleHalfHeight: 0.15,
    capsuleAxis: 'z',
    modelOffset: [0, -0.4, 0],
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
        '/assets/audio/voices/001-bulbasaur/cry-01.wav',
        '/assets/audio/voices/001-bulbasaur/cry-02.wav',
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
