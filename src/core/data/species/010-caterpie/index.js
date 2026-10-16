const LEVEL = 5

const HP = 45
const ATTACK = 30
const DEFENSE = 35
const SP_ATK = 20
const SP_DEF = 20
const SPEED = 45

const HP_EV = 0
const ATTACK_EV = 0
const DEFENSE_EV = 0
const SP_ATK_EV = 0
const SP_DEF_EV = 0
const SPEED_EV = 0

// Modelo do Let's Go (o Caterpie não está no dump do Legends: Z-A), pelo
// scripts/blender/convert-pokemon-lgpe.py. O LGPE tem menos animações que o
// Z-A: um ataque só (todas as variações usam ele), um desmaio sem
// "levantar", nada de dash próprio nem piscar (o olho é pintado na textura).
export const CATERPIE = {
  id: 'caterpie',
  dexNumber: 10,
  level: LEVEL,
  baseXp: 39,
  growthRate: 'medium-fast',
  capture: { rate: 255 },
  kind: 'pokemon',
  types: ['bug'],
  sprite: {
    path: 'https://play.pokemonshowdown.com/sprites/ani/caterpie.gif',
  },
  model: {
    path: '/assets/models/010-caterpie.glb',
    scale: 1.2,
    texture: {
      0: {
        path: '/assets/textures/010-caterpie/default/pm0010_00_00_body_alb.png',
        flipY: false,
      },
    },
  },

  nativeAnimations: {
    roar: 'roar',
    idle: 'idle',
    walk: 'walk',
    run: 'run',
    attack: 'attack',
    attackAlt: 'attack',
    attackRanged: 'attack',
    attackRangedAlt: 'attack',
    faint: { start: 'faintStart' },
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
    dash: 'jumpLoop',
    battleIdle: 'battleIdle',
    appeal: 'appeal',
    hit: 'hit',
  },

  // Sem mãos: come do chão, embaixo da boca.
  vfx: {
    eatFood: {
      ground: 'EffMouth01',
      position: { x: 0, y: -0.05, z: 0.1 },
      rotation: { x: 90, y: 0, z: 90 },
      scale: 0.8,
    },
  },
  actions: {
    appeal: { duration: 1.6 },
  },

  body: {
    capsuleRadius: 0.07,
    capsuleHalfHeight: 0.04,
    capsuleAxis: 'y',
    modelOffset: [0, -0.12, 0],
  },
  movement: {
    walkSpeed: 0.8,
    runSpeed: 2.5,
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
      clips: ['/assets/audio/voices/010-caterpie/cry-01.wav'],
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
  moves: [{ id: 'bug-bite', requires: { level: 9 } }],
  // Na série o Caterpie não tem como atacar de verdade: se defende soltando
  // um cheiro ruim pelas antenas. Quase todo nasce pacífico e só revida.
  wild: { hostileChance: 0.15 },
}
