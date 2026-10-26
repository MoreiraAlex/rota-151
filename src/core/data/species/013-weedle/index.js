const LEVEL = 5

const HP = 40
const ATTACK = 35
const DEFENSE = 30
const SP_ATK = 20
const SP_DEF = 20
const SPEED = 50

const HP_EV = 0
const ATTACK_EV = 0
const DEFENSE_EV = 0
const SP_ATK_EV = 0
const SP_DEF_EV = 0
const SPEED_EV = 0

export const WEEDLE = {
  id: 'weedle',
  dexNumber: 13,
  level: LEVEL,
  baseXp: 39,
  growthRate: 'medium-fast',
  capture: { rate: 255 },
  kind: 'pokemon',
  types: ['bug', 'poison'],
  sprite: {
    path: 'https://play.pokemonshowdown.com/sprites/ani/weedle.gif',
  },
  model: {
    path: '/assets/models/013-weedle.glb',
    scale: 1.2,
    texture: {
      0: {
        path: '/assets/textures/013-weedle/default/pm0013_00_00_body_alb.png',
        flipY: false,
      },
      1: {
        path: '/assets/textures/013-weedle/default/pm0013_00_00_eye_alb.png',
        flipY: false,
      },
    },
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

  // Sem mãos: come do chão, embaixo da cabeça.
  vfx: {
    eatFood: {
      ground: 'head',
      position: { x: 0, y: -0.05, z: 0.1 },
      rotation: { x: 90, y: 0, z: 90 },
      scale: 0.8,
    },
  },
  nativeBlink: { animation: 'blink', minInterval: 2, maxInterval: 6 },
  actions: {
    appeal: { duration: 1 },
  },

  body: {
    capsuleRadius: 0.07,
    capsuleHalfHeight: 0.04,
    capsuleAxis: 'y',
    modelOffset: [0, -0.12, 0],
    trigger: { radius: 0.15, halfLength: 0, angle: 0, offset: { x: 0, z: 0 } },
  },
  movement: {
    walkSpeed: 0.8,
    runSpeed: 2.75,
    turnSpeed: 10,
    jumpSpeed: 5.5,
  },
  camera: {
    targetHeight: 0.3,
    shoulderOffset: 0,
  },
  vitals: {
    runStaminaDrainPerSecond: 0.25,
    jumpStaminaCost: 1,
  },
  sounds: {
    footstepGroup: 'crawl',
    voice: {
      clips: ['/assets/audio/voices/013-weedle/cry-01.wav'],
      volume: 0.8,
      refDistance: 2,
      minInterval: 4,
      maxInterval: 32,
    },
    dashGroup: 'default',
    jumpGroup: 'default',
  },
  skills: {
    1: 'poison-sting',
    2: 'string-shot',
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
      id: 'poison-sting',
      overrides: {
        animation: { clipKey: 'attackAlt' },
        visual: { positionOffset: { x: 0, y: 0, z: 0.2 } },
      },
    },
    {
      id: 'string-shot',
      overrides: {
        visual: { positionOffset: { x: 0, y: 0.025, z: 0.15 } },
      },
    },

    {
      id: 'bug-bite',
      overrides: { animation: { clipKey: 'attack' } },
      requires: { level: 9 },
    },
  ],
  // Na série o Weedle usa o ferrão pra se defender (o agressivo é o
  // Beedrill): a maioria nasce pacífica e revida se apanhar.
  wild: { hostileChance: 0.25 },
}
