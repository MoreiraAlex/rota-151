import CRY_CLIP from './clips/cry.json'

const LEVEL = 5

const HP = 40
const ATTACK = 45
const DEFENSE = 40
const SP_ATK = 35
const SP_DEF = 35
const SPEED = 56

const HP_EV = 0
const ATTACK_EV = 0
const DEFENSE_EV = 0
const SP_ATK_EV = 0
const SP_DEF_EV = 0
const SPEED_EV = 0

const BODY_A_00 = {
  path: '/assets/textures/016-pidgey/default/pm0016_00_00_body_a_00_alb.png',
  flipY: false,
}

export const PIDGEY = {
  id: 'pidgey',
  dexNumber: 16,
  level: LEVEL,
  baseXp: 50,
  growthRate: 'medium-slow',
  capture: { rate: 255 },
  kind: 'pokemon',
  types: ['normal', 'flying'],
  sprite: {
    path: 'https://play.pokemonshowdown.com/sprites/ani/pidgey.gif',
  },
  model: {
    path: '/assets/models/016-pidgey.glb',
    scale: 1.2,
    // As asas fechadas são malhas à parte, com a textura do corpo.
    texture: {
      0: BODY_A_00,
      1: {
        path: '/assets/textures/016-pidgey/default/pm0016_00_00_body_a_01_alb.png',
        flipY: false,
      },
      2: {
        path: '/assets/textures/016-pidgey/default/pm0016_00_00_body_b_00_alb.png',
        flipY: false,
      },
      3: {
        path: '/assets/textures/016-pidgey/default/pm0016_00_00_body_b_01_alb.png',
        flipY: false,
      },
      4: {
        path: '/assets/textures/016-pidgey/default/pm0016_00_00_eye_alb.png',
        flipY: false,
      },
      5: BODY_A_00,
      6: BODY_A_00,
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
    // Voo livre (docs/features/060-ajustes-por-especie.md, Parte 2): o
    // conjunto de voo do Z-A (2xxxx); o dash no ar é a arrancada dele.
    flyIdle: 'flyIdle',
    fly: 'fly',
    flyFast: 'flyFast',
    flyDash: { sequence: ['flyDash', { animation: 'flyDashEnd', frames: 10 }] },
    battleIdle: 'battleIdle',
    appeal: 'appeal',
    hit: 'hit',
  },

  // Sem mãos: bica do chão, embaixo do bico.
  vfx: {
    eatFood: {
      ground: 'lower_jaw',
      position: { x: 0, y: -0.05, z: 0.1 },
      rotation: { x: 90, y: 0, z: 90 },
      scale: 1,
    },
  },
  nativeBlink: { animation: 'blink', minInterval: 2, maxInterval: 6 },
  actions: {
    appeal: { duration: 1 },
  },

  body: {
    capsuleRadius: 0.12,
    capsuleHalfHeight: 0.06,
    capsuleAxis: 'y',
    modelOffset: [0, -0.21, 0],
  },
  movement: {
    walkSpeed: 1.5,
    runSpeed: 4,
    turnSpeed: 10,
    jumpSpeed: 6.5,
  },
  // Voo livre (`V`): velocidade do voo e do rápido (Shift). O gasto de
  // stamina é pelo nível (`GAME_CONFIG.ACTION_COST`).
  flight: {
    speed: 3.5,
    fastSpeed: 8,
  },
  camera: {
    targetHeight: 0.4,
    shoulderOffset: 0,
  },
  vitals: {
    runStaminaDrainPerSecond: 0.25,
    jumpStaminaCost: 1,
  },
  sounds: {
    footstepGroup: 'bird',
    // no voo, batida de asa (no chão, a unha do `bird`)
    flightGroup: 'wing',
    voice: {
      clips: ['/assets/audio/voices/016-pidgey/cry-01.wav'],
      volume: 0.8,
      refDistance: 2,
      minInterval: 4,
      maxInterval: 32,
    },
    dashGroup: 'default',
    jumpGroup: 'default',
  },
  skills: {
    1: 'tackle',
    2: 'sand-attack',
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
  moves: [{ id: 'gust', requires: { level: 9 } }],
  // Na série o Pidgey é dócil: atacado, joga areia pra se proteger em vez
  // de revidar. Quase todos nascem pacíficos.
  wild: { hostileChance: 0.1 },
}
