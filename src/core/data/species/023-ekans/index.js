import CRY_CLIP from './clips/cry.json'

const LEVEL = 5

const HP = 35
const ATTACK = 60
const DEFENSE = 44
const SP_ATK = 40
const SP_DEF = 54
const SPEED = 55

const HP_EV = 0
const ATTACK_EV = 0
const DEFENSE_EV = 0
const SP_ATK_EV = 0
const SP_DEF_EV = 0
const SPEED_EV = 0

export const EKANS = {
  id: 'ekans',
  dexNumber: 23,
  level: LEVEL,
  baseXp: 58,
  growthRate: 'medium-fast',
  capture: { rate: 255 },
  kind: 'pokemon',
  types: ['poison'],
  sprite: {
    path: 'https://play.pokemonshowdown.com/sprites/ani/ekans.gif',
  },
  model: {
    path: '/assets/models/023-ekans.glb',
    scale: 1.2,
    texture: {
      0: {
        path: '/assets/textures/023-ekans/default/pm0023_00_00_body_a_alb.png',
        flipY: false,
      },
      1: {
        path: '/assets/textures/023-ekans/default/pm0023_00_00_body_b_alb.png',
        flipY: false,
      },
      2: {
        path: '/assets/textures/023-ekans/default/pm0023_00_00_eye_alb.png',
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
    attackAlt: 'attack',
    attackRanged: 'attackRanged',
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
  },

  // Sem mãos: come do chão, embaixo da boca.
  vfx: {
    eatFood: {
      ground: 'lower_jaw',
      position: { x: 0, y: -0.05, z: 0.25 },
      rotation: { x: 90, y: 0, z: 90 },
      scale: 1.25,
    },
  },
  nativeBlink: { animation: 'blink', minInterval: 2, maxInterval: 6 },
  actions: {
    appeal: { duration: 1 },
  },

  body: {
    capsuleRadius: 0.15,
    capsuleHalfHeight: 0.15,
    capsuleAxis: 'z',
    modelOffset: [0, -0.165, 0],
  },
  movement: {
    walkSpeed: 2.75,
    runSpeed: 5.5,
    turnSpeed: 10,
    jumpSpeed: 7,
  },
  camera: {
    targetHeight: 0.35,
    shoulderOffset: 0,
  },
  vitals: {
    runStaminaDrainPerSecond: 0.25,
    jumpStaminaCost: 1,
  },
  sounds: {
    footstepGroup: 'crawl',
    voice: {
      clips: ['/assets/audio/voices/023-ekans/cry-01.wav'],
      volume: 0.8,
      refDistance: 2,
      minInterval: 4,
      maxInterval: 32,
    },
    dashGroup: 'default',
    jumpGroup: 'default',
  },
  skills: {
    1: 'wrap',
    2: 'leer',
    3: 'poison-sting',
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
    { id: 'wrap' },
    {
      id: 'leer',
      overrides: { visual: { positionOffset: { x: 0, y: 0.5, z: 0.25 } } },
    },
    {
      id: 'poison-sting',
      overrides: {
        animation: { clipKey: 'attackRanged' },
        visual: { positionOffset: { x: 0, y: 0.4, z: 0.5 } },
      },
    },

    { id: 'bite', requires: { level: 9 } },
    {
      id: 'glare',
      requires: { level: 12 },
      // o olho do Ekans: o mesmo do Leer dele
      overrides: { visual: { positionOffset: { x: 0, y: 0.5, z: 0.25 } } },
    },
  ],
  // Na série o Ekans caça em silêncio e dá o bote: mais selvagens nascem
  // agressivos que o Weedle e o Pidgey.
  wild: { hostileChance: 0.5 },
}
