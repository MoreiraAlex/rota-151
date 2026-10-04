import CRY_CLIP from './clips/cry.json'
import { BASIC_ATTACK } from './basicAttack'

const LEVEL = 5

const HP = 44
const ATTACK = 48
const DEFENSE = 65
const SP_ATK = 50
const SP_DEF = 64
const SPEED = 43

const HP_EV = 0
const ATTACK_EV = 0
const DEFENSE_EV = 0
const SP_ATK_EV = 0
const SP_DEF_EV = 0
const SPEED_EV = 0

export const SQUIRTLE = {
  id: 'squirtle',
  dexNumber: 7,
  level: LEVEL,
  baseXp: 63,
  growthRate: 'medium-slow',
  kind: 'pokemon',
  sprite: { path: 'https://play.pokemonshowdown.com/sprites/ani/squirtle.gif' },
  model: {
    path: '/assets/models/007-squirtle.glb',
    scale: 1.2,
    texture: {
      0: {
        path: '/assets/textures/007-squirtle/default/pm0007_00_00_body_a_alb.png',
        flipY: false,
      },
      1: {
        path: '/assets/textures/007-squirtle/default/pm0007_00_00_body_b_01_alb.png',
        flipY: false,
      },
      2: {
        path: '/assets/textures/007-squirtle/default/pm0007_00_00_eye_alb.png',
        flipY: false,
      },
      3: {
        path: '/assets/textures/007-squirtle/default/pm0007_00_00_body_b_00_alb.png',
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
    walk: { animation: 'walk', speed: 1.5 },
    run: { animation: 'run', speed: 1.2 },
    attack: { sequence: [{ animation: 'attack', frames: 30 }] },
    attackRanged: 'attackRanged',
    attackAlt: {
      sequence: ['attackAltStart', { animation: 'attackAltEnd', frames: 30 }],
    },
    attackRangedAlt: {
      start: 'attackRangedAltStart',
      loop: 'attackRangedAltLoop',
    },
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
    hit: 'hit',
  },

  nativeBlink: { animation: 'blink', minInterval: 2, maxInterval: 6 },
  actions: {
    appeal: { duration: 1 },
  },

  body: {
    capsuleRadius: 0.2,
    capsuleHalfHeight: 0.07,
    capsuleAxis: 'y',
    modelOffset: [0, -0.26, 0],
  },
  movement: {
    walkSpeed: 2.25,
    runSpeed: 5,
    turnSpeed: 10,
    jumpSpeed: 7,
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
  basicAttack: BASIC_ATTACK,
  skills: {
    1: {
      id: 'tackle',
      overrides: {
        range: 1.4,
        duration: 1,
        effectAt: 0.6,
        animation: { clipKey: 'attackAlt' },
      },
    },
    2: {
      id: 'water-gun',
      overrides: {
        visual: { positionOffset: { x: 0, y: 0, z: 0.5 }, scale: 1.5 },
      },
    },
    3: { id: 'tail-whip' },
  },

  stats: {
    hp: { base: HP, ev: HP_EV, regenPercent: 0.25, regenDelay: 10 },
    energy: { regenPercent: 40, regenDelay: 2 },
    attack: { base: ATTACK, ev: ATTACK_EV },
    defense: { base: DEFENSE, ev: DEFENSE_EV },
    sp_atk: { base: SP_ATK, ev: SP_ATK_EV },
    sp_def: { base: SP_DEF, ev: SP_DEF_EV },
    speed: { base: SPEED, ev: SPEED_EV },
  },
  moves: [],
}
