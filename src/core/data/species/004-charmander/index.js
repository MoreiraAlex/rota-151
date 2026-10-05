import CRY_CLIP from './clips/cry.json'
import { BASIC_ATTACK } from './basicAttack'

const LEVEL = 5

const HP = 39
const ATTACK = 52
const DEFENSE = 43
const SP_ATK = 60
const SP_DEF = 50
const SPEED = 65

const HP_EV = 0
const ATTACK_EV = 0
const DEFENSE_EV = 0
const SP_ATK_EV = 0
const SP_DEF_EV = 0
const SPEED_EV = 0

export const CHARMANDER = {
  id: 'charmander',
  dexNumber: 4,
  level: LEVEL,
  baseXp: 62,
  growthRate: 'medium-slow',
  kind: 'pokemon',
  sprite: {
    path: 'https://play.pokemonshowdown.com/sprites/ani/charmander.gif',
  },
  model: {
    path: '/assets/models/004-charmander.glb',
    scale: 1.2,
    texture: {
      0: {
        path: '/assets/textures/004-charmander/default/pm0004_00_00_body_alb.png',
        flipY: false,
      },
      1: {
        path: '/assets/textures/004-charmander/default/pm0004_00_00_eye_alb.png',
        flipY: false,
      },
      2: {
        path: '/assets/textures/004-charmander/default/pm0004_00_00_fire_alb.png',
        flipY: false,
      },
    },
  },

  clips: {
    cry: CRY_CLIP,
  },
  nativeAnimations: {
    // Growl (skill de status): o rugido
    roar: 'roar',
    idle: 'idle',
    walk: { animation: 'walk', speed: 1.5 },
    run: { animation: 'run', speed: 1.2 },
    attack: {
      start: 'attackAltStart',
      loop: 'attackAltLoop',
      end: 'attackAltEnd',
    },
    attackAlt: 'attack',
    attackRanged: 'attackRanged',
    attackRangedAlt: {
      start: 'attackRangedAltStart',
      loop: 'attackRangedAltLoop',
      // end: 'attackRangedAltEnd',
    },
    faint: {
      start: 'faintStart',
      loop: 'faintLoop',
      end: 'faintEnd',
    },
    rest: {
      start: 'restStart',
      loop: 'restLoop',
      end: 'restEnd',
    },
    fall: 'fallLoop',
    jump: 'jumpLoop',
    dash: { sequence: ['stepIn', { animation: 'stepInEnd', frames: 10 }] },
    battleIdle: 'battleIdle',
    appeal: 'appeal',
    // atordoada por golpe interrompido (ação `'hit'`)
    hit: 'hit',
  },
  nativeBlink: { animation: 'blink', minInterval: 2, maxInterval: 6 },
  actions: {
    appeal: { duration: 1 },
  },

  body: {
    capsuleRadius: 0.25,
    capsuleHalfHeight: 0.09,
    capsuleAxis: 'y',
    modelOffset: [0, -0.35, 0],
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
  basicAttack: BASIC_ATTACK,
  skills: {
    1: {
      id: 'growl',
      overrides: {
        audio: {
          cry: false,
          clips: ['/assets/audio/voices/004-charmander/cry-02.wav'],
          volume: 2,
          refDistance: 4,
        },
      },
    },
    2: { id: 'tackle', overrides: { range: 1.4, duration: 1, effectAt: 0.4 } },
    3: {
      id: 'ember',
      overrides: {
        duration: 1,
        effectAt: 0.8,
        visual: { positionOffset: { x: 0, y: 0, z: 0.5 } },
      },
    },
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
  moves: [
    {
      id: 'smokescreen',
      overrides: {
        range: 2.5,
        radius: 2,
        duration: 2,
        effectAt: 0.6,
        visual: { positionOffset: { x: 0, y: 0, z: 0.5 }, scale: 3 },
      },
    },
    {
      id: 'flamethrower',
      overrides: {
        range: 2.5,
        radius: 2,
        duration: 2,
        effectAt: 0.6,
        visual: { positionOffset: { x: 0, y: 0, z: 0.5 }, scale: 3 },
      },
    },
  ],
}
