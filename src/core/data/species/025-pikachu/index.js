import CRY_CLIP from './clips/cry.json'

const LEVEL = 5

const HP = 35
const ATTACK = 55
const DEFENSE = 40
const SP_ATK = 50
const SP_DEF = 50
const SPEED = 90

const HP_EV = 0
const ATTACK_EV = 0
const DEFENSE_EV = 0
const SP_ATK_EV = 0
const SP_DEF_EV = 0
const SPEED_EV = 0

const TEXTURES = '/assets/textures/025-pikachu/default'
const BODY_A_00 = {
  path: `${TEXTURES}/pm0025_00_00_body_a_00_alb.png`,
  flipY: false,
}
const BODY_A_01 = {
  path: `${TEXTURES}/pm0025_00_00_body_a_01_alb.png`,
  flipY: false,
}
const BODY_B = { path: `${TEXTURES}/pm0025_00_00_body_b_alb.png`, flipY: false }
const BODY_C = { path: `${TEXTURES}/pm0025_00_00_body_c_alb.png`, flipY: false }
const EYE = { path: `${TEXTURES}/pm0025_00_00_eye_alb.png`, flipY: false }

export const PIKACHU = {
  id: 'pikachu',
  dexNumber: 25,
  level: LEVEL,
  baseXp: 112,
  growthRate: 'medium-fast',
  capture: { rate: 190 },
  kind: 'pokemon',
  types: ['electric'],
  sprite: {
    path: 'https://play.pokemonshowdown.com/sprites/ani/pikachu.gif',
  },
  model: {
    path: '/assets/models/025-pikachu.glb',
    scale: 1.2,
    // Cada olho, a ponta da cauda e a língua são malhas à parte, com as
    // texturas do corpo.
    texture: {
      0: BODY_A_00,
      1: BODY_A_01,
      2: BODY_B,
      3: BODY_C,
      4: EYE,
      5: EYE,
      6: BODY_B,
      7: BODY_A_00,
      8: BODY_A_01,
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
    // O dump do Pikachu não tem a espera de batalha principal, só a outra.
    battleIdle: 'idle',
    appeal: 'appeal',
    hit: 'hit',
    // atordoada por condição (a paralisia): entra, repete e sai
    stunned: { start: 'stunStart', loop: 'stunLoop', end: 'stunEnd' },
  },

  vfx: {
    eatFood: {
      hands: ['left_hand', 'right_hand'],
      position: { x: 0, y: 0, z: 0.05 },
      rotation: { x: 0, y: 180, z: 0 },
      scale: 1.25,
    },
  },
  nativeBlink: { animation: 'blink', minInterval: 2, maxInterval: 6 },
  actions: {
    appeal: { duration: 1 },
  },

  body: {
    capsuleRadius: 0.2,
    capsuleHalfHeight: 0.08,
    capsuleAxis: 'y',
    modelOffset: [0, -0.28, 0],
    trigger: { radius: 0.25, halfLength: 0, angle: 0, offset: { x: 0, z: 0 } },
  },
  movement: {
    walkSpeed: 2.25,
    runSpeed: 5,
    turnSpeed: 10,
    jumpSpeed: 7,
  },
  camera: {
    targetHeight: 0.45,
    shoulderOffset: 0,
  },
  vitals: {
    runStaminaDrainPerSecond: 0.25,
    jumpStaminaCost: 1,
  },
  sounds: {
    footstepGroup: 'medium',
    voice: {
      clips: ['/assets/audio/voices/025-pikachu/cry-01.wav'],
      volume: 0.8,
      refDistance: 2,
      minInterval: 4,
      maxInterval: 32,
    },
    dashGroup: 'default',
    jumpGroup: 'default',
  },
  skills: {
    1: 'thunder-shock',
    2: 'quick-attack',
    3: 'tail-whip',
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
    { id: 'thunder-shock' },
    {
      id: 'quick-attack',
      overrides: { effectAt: 0.25, duration: 1.25 },
    },
    {
      id: 'tail-whip',
      overrides: { animation: { clipKey: 'attackAlt' } },
    },

    { id: 'thunder-wave', requires: { level: 4 } },
    { id: 'double-team', requires: { level: 8 } },
    {
      id: 'electro-ball',
      requires: { level: 12 },
      overrides: { visual: { positionOffset: { x: 0, y: 0.45, z: 0.15 } } },
    },
  ],
  // Na série o Pikachu é arisco: guarda eletricidade nas bochechas e dá
  // choque quando se sente ameaçado. Mais desconfiado que o Pidgey, menos
  // agressivo que o Ekans.
  wild: { hostileChance: 0.3 },
}
