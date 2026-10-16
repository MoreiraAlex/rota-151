import CRY_CLIP from './clips/cry.json'
import { LGPE_EYE_ATLAS } from '../lgpeEyeAtlas'

const LEVEL = 5

const HP = 30
const ATTACK = 56
const DEFENSE = 35
const SP_ATK = 25
const SP_DEF = 35
const SPEED = 72

const HP_EV = 0
const ATTACK_EV = 0
const DEFENSE_EV = 0
const SP_ATK_EV = 0
const SP_DEF_EV = 0
const SPEED_EV = 0

// Modelo do Let's Go (o Rattata não está no dump do Legends: Z-A), pelo
// scripts/blender/convert-pokemon-lgpe.py. Tem um ataque físico e um
// especial; não tem animação de dormir (o `rest` cai no idle) nem dash. O
// piscar é por textura (`eyeStates`), como no LGPE.
export const RATTATA = {
  id: 'rattata',
  dexNumber: 19,
  level: LEVEL,
  baseXp: 51,
  growthRate: 'medium-fast',
  capture: { rate: 255 },
  kind: 'pokemon',
  types: ['normal'],
  sprite: {
    path: 'https://play.pokemonshowdown.com/sprites/ani/rattata.gif',
  },
  model: {
    path: '/assets/models/019-rattata.glb',
    scale: 1.2,
    texture: {
      0: {
        path: '/assets/textures/019-rattata/default/pm0019_00_00_body_alb.png',
        flipY: false,
      },
      1: {
        path: '/assets/textures/019-rattata/default/pm0019_00_00_eye_alb.png',
        flipY: false,
        ...LGPE_EYE_ATLAS,
      },
      // bigodes: malha à parte, com a textura do corpo
      2: {
        path: '/assets/textures/019-rattata/default/pm0019_00_00_body_alb.png',
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
    attack: 'attack',
    attackAlt: 'attack',
    attackRanged: 'attackRanged',
    attackRangedAlt: 'attackRanged',
    faint: { start: 'faintStart' },
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

  // Come do chão, embaixo da boca.
  vfx: {
    eatFood: {
      ground: 'EffMouth01',
      position: { x: 0, y: -0.05, z: 0.1 },
      rotation: { x: 90, y: 0, z: 90 },
      scale: 1,
    },
  },
  actions: {
    appeal: { duration: 1.6 },
  },

  // Quadrúpede baixo: cápsula deitada ao longo do corpo.
  body: {
    capsuleRadius: 0.15,
    capsuleHalfHeight: 0.1,
    capsuleAxis: 'z',
    modelOffset: [0, -0.165, -0.05],
  },
  movement: {
    walkSpeed: 2.25,
    runSpeed: 5,
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
    footstepGroup: 'medium',
    voice: {
      clips: ['/assets/audio/voices/019-rattata/cry-01.wav'],
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
    2: 'tail-whip',
    3: 'quick-attack',
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
    { id: 'focus-energy', requires: { level: 7 } },
    { id: 'bite', requires: { level: 10 } },
  ],
  // Na série ele morde qualquer coisa quando ataca e vive em bando: mais
  // agressivo que o Caterpie e o Weedle.
  wild: { hostileChance: 0.4 },
}
