import CRY_CLIP from './clips/cry.json'
import { BASIC_ATTACK } from './basicAttack'

const LEVEL = 100

const HP = 45
const ATTACK = 49
const DEFENSE = 65
const SP_ATK = 65
const SP_DEF = 45
const SPEED = 45

const HP_EV = 0
const ATTACK_EV = 0
const DEFENSE_EV = 0
const SP_ATK_EV = 0
const SP_DEF_EV = 0
const SPEED_EV = 0

export const BULBASAUR = {
  id: 'bulbasaur',
  dexNumber: 1,
  level: LEVEL,
  kind: 'pokemon',
  sprite: {
    path: 'https://play.pokemonshowdown.com/sprites/ani/bulbasaur.gif',
  },
  model: {
    path: '/assets/models/001-bulbasaur.glb',
    scale: 1.2,
    texture: {
      0: {
        path: '/assets/textures/001-bulbasaur/default/pm0001_00_00_body_a_alb.png',
        flipY: false,
      },
      1: {
        path: '/assets/textures/001-bulbasaur/default/pm0001_00_00_body_b_alb.png',
        flipY: false,
      },
      2: {
        path: '/assets/textures/001-bulbasaur/default/pm0001_00_00_eye_alb.png',
        flipY: false,
      },
      3: {
        path: '/assets/textures/001-bulbasaur/default/pm0001_00_00_body_b_alb.png',
        flipY: false,
      },
      4: {
        path: '/assets/textures/001-bulbasaur/default/pm0001_00_00_body_b_alb.png',
        flipY: false,
      },
    },
  },

  clips: {
    cry: CRY_CLIP,
  },
  nativeAnimations: {
    roar: 'roar',
    idle: 'idle',
    walk: 'walk',
    run: 'run',
    attackBasic: { sequence: [{ animation: 'attackRangedAltStart' }, { animation: 'attackRangedAltEnd', frames: 10 }], },
    attackBasicAlt: { sequence: ['attackAltStart', 'attackAltEnd'] },
    attackAlt: 'attack',
    attackRanged: { sequence: [{ animation: 'attackRanged', frames: 40 }] },
    faint: {
      start: 'faintStart',
      loop: 'faintLoop',
      end: 'faintEnd',
    },
    fall: 'fallLoop',
    jump: 'jumpLoop',
    dash: { sequence: ['stepIn', { animation: 'stepInEnd', frames: 10 }] },
    battleIdle: 'battleIdle',
    appeal: 'appeal',
    // atordoada por golpe interrompido (ação `'hit'`)
    hit: 'hit',
    // skill Growth (`animation.clipKey: 'growth'`)
    charge: { loop: 'charge' },
  },

  nativeBlink: { animation: 'blink', minInterval: 2, maxInterval: 6 },
  actions: {
    appeal: { duration: 1 },
  },

  body: {
    capsuleRadius: 0.3,
    capsuleHalfHeight: 0.2,
    capsuleAxis: 'z',
    modelOffset: [0, -0.28, -0.08],
  },
  movement: {
    walkSpeed: 1.5,
    runSpeed: 4,
    turnSpeed: 10,
    jumpSpeed: 9,
  },
  camera: {
    targetHeight: 0.5,
    shoulderOffset: 0,
  },
  vitals: {
    runStaminaDrainPerSecond: 0.25,
    jumpStaminaCost: 1,
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
  basicAttack: BASIC_ATTACK,
  skills: {
    1: { id: 'growth' },
    2: {
      id: 'tackle',
      overrides: {
        range: 1,
        duration: 1,
        effectAt: 0.4,
        // animationFrames: 30,
        animation: { clipKey: 'attackBasicAlt' },
      },
    },
    3: {
      id: 'vine-whip',
      overrides: {
        range: 2,
        duration: 0.8,
        effectAt: 0.6,
      },
      // overrides: {
      //   range: 1.8,
      //   duration: 0.8,
      //   effectAt: 0.6,
      //   animationFrames: 30,
      // },
    },
    // 2: { id: 'razor-leaf', overrides: { range: 4, duration: 2, effectAt: 1 } },
  },
  stats: {
    hp: { base: HP, ev: HP_EV, regenPercent: 2, regenDelay: 5 },
    energy: { regenPercent: 45, regenDelay: 2 },
    attack: { base: ATTACK, ev: ATTACK_EV },
    defense: { base: DEFENSE, ev: DEFENSE_EV },
    sp_atk: { base: SP_ATK, ev: SP_ATK_EV },
    sp_def: { base: SP_DEF, ev: SP_DEF_EV },
    speed: { base: SPEED, ev: SPEED_EV },
  },
  moves: [],
}
