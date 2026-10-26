import CRY_CLIP from './clips/cry.json'

const LEVEL = 5

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
  baseXp: 64,
  growthRate: 'medium-slow',
  // Taxa de captura (0-255, escala da série) — docs/features/043-captura.md.
  capture: { rate: 45 },
  kind: 'pokemon',
  types: ['grass', 'poison'],
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
    walk: { animation: 'walk', speed: 1.5 },
    run: { animation: 'run', speed: 1.2 },
    attack: {
      start: 'attackAltStart',
      loop: 'attackAltLoop',
      end: 'attackAltEnd',
    },
    attackBasicAlt: { sequence: ['attackAltStart', 'attackAltEnd'] },
    attackAlt: 'attack',
    attackRanged: { sequence: [{ animation: 'attackRanged', frames: 40 }] },
    attackRangedAlt: {
      start: 'attackRangedAltStart',
      loop: 'attackRangedAltLoop',
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
    eat: {
      start: 'eatStart',
      loop: 'eatLoop',
      end: 'eatEnd',
    },
    fall: 'fallLoop',
    jump: 'jumpLoop',
    dash: { sequence: ['stepIn', { animation: 'stepInEnd', frames: 10 }] },
    battleIdle: 'battleIdle',
    appeal: 'appeal',
    hit: 'hit',
    // atordoada por condição (a paralisia): entra, repete e sai
    stunned: { start: 'stunStart', loop: 'stunLoop', end: 'stunEnd' },
    charge: { loop: 'charge' },
  },

  // Onde fica a fruta enquanto come (docs/features/042-itens-da-beta.md,
  // `view/systems/eatingFoodViewSystem.js`) — ver `_template/`.
  vfx: {
    eatFood: {
      ground: 'jaw',
      position: { x: 0, y: -0.05, z: 0.25 },
      rotation: { x: 90, y: 0, z: 90 },
      scale: 1.5,
    },
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
  skills: {
    1: 'growl',
    2: 'tackle',
    3: 'vine-whip',
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
      id: 'growl',
      overrides: {
        audio: {
          cry: false,
          clips: ['/assets/audio/voices/001-bulbasaur/cry-02.wav'],
          volume: 2,
          refDistance: 4,
        },
        effectAt: 0.3,
        visual: { positionOffset: { x: 0, y: 0, z: 0.45 } },
      },
    },
    {
      id: 'tackle',
      overrides: {
        duration: 0.8,
        effectAt: 0.4,
        animation: { clipKey: 'attackBasicAlt' },
        animationFrames: 1,
      },
    },
    {
      id: 'vine-whip',
      overrides: {
        duration: 0.8,
        effectAt: 0.4,
      },
    },

    { id: 'growth', requires: { level: 6 } },
    {
      id: 'leech-seed',
      requires: { level: 9 },
      overrides: { visual: { positionOffset: { x: 0, y: 0.5, z: 0 } } },
    },
    {
      id: 'razor-leaf',
      requires: { level: 12 },
      overrides: {
        duration: 1.5,
        effectAt: 0.75,
        visual: { positionOffset: { x: 0, y: 0.5, z: 0 } },
      },
    },
  ],
}
