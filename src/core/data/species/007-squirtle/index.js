import IDLE_CLIP from './clips/idle.json'
import WALK_CLIP from './clips/walk.json'
import RUN_CLIP from './clips/run.json'
import CRY_CLIP from './clips/cry.json'
import { calculateAttackInterval, calculateCP, calculateEnergyStat, calculateHpStat, calculateStat } from '../stats'

const LEVEL = 5

const HP = 44
const ATTACK = 48
const DEFENSE = 65
const SP_ATK = 50
const SP_DEF = 64
const SPEED = 43

const HP_IV = 24
const ATTACK_IV = 24
const DEFENSE_IV = 24
const SP_ATK_IV = 22
const SP_DEF_IV = 20
const SPEED_IV = 20

const HP_EV = 0
const ATTACK_EV = 0
const DEFENSE_EV = 0
const SP_ATK_EV = 0
const SP_DEF_EV = 0
const SPEED_EV = 0

export const SQUIRTLE = {
  id: 'squirtle',
  dexNumber: 7,
  // Nível fixo por ESPÉCIE — ver comentário completo em `../fox/index.js`.
  level: LEVEL,
  kind: 'pokemon',
  sprite: { path: 'https://play.pokemonshowdown.com/sprites/ani/squirtle.gif' },
  model: {
    path: '/assets/models/007-squirtle.glb',
    scale: 0.020,
    texture: {
      0: { path: '/assets/textures/007-squirtle/default/pm0007_00_Body1.png' },
      1: { 
        path: '/assets/textures/007-squirtle/default/pm0007_00_Eye1.png',
        flipY: false,
        center: {x: 0.5, y: 0.5},
        repeat: {x: 1, y: 1},
        rotation: 180,
        eyeStates: {
          awake: {
            open: { x: -0.5, y: 0 },
            closed: { x: -0.5, y: 0.5 },
          },
        },
        blink: { minInterval: 2, maxInterval: 6, closedDuration: 0.15 },
      },
    },
  },
  clips: {
    idle: IDLE_CLIP,
    walk: WALK_CLIP,
    run: RUN_CLIP,
    cry: CRY_CLIP
  },
  body: {
    capsuleRadius: 0.3,
    capsuleHalfHeight: 0.15,
    capsuleAxis: 'y',
    modelOffset: [0, -0.45, 0],
  },
  movement: {
    walkSpeed: 2,
    runSpeed: 6,
    turnSpeed: 10,
    jumpSpeed: 9,
  },
  camera: {
    targetHeight: 0.5,
    shoulderOffset: 0,
  },
  vitals: {
    runStaminaDrainPerSecond: 1,
    jumpStaminaCost: 3,
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
  // Quais ataques/skills — ver docs/features/025-ataque-comum-de-
  // criatura.md e o comentário completo em `../fox/index.js`. `range`
  // sobrescrito pra 1 (menor que o `1.4` da definição base de `'punch'`)
  // — corpo pequeno do Squirtle, alcance mais curto fica proporcional.
  // `secondary1` (tecla Q, 9ª rodada) — Redemoinho (`core/data/attacks/
  // whirlpool/index.js`), sem override nenhum ainda.
  attacks: {
    primary: { 
      id: 'punch', 
      overrides: { 
        range: 1,
        duration: calculateAttackInterval(calculateStat({ base: SPEED, iv: SPEED_IV, ev: SPEED_EV, level: LEVEL })),
        effectAt: calculateAttackInterval(calculateStat({ base: SPEED, iv: SPEED_IV, ev: SPEED_EV, level: LEVEL })) * 0.4
      }
    },
    secondary1: 'whirlpool',
  },
  stats: {
    cp: calculateCP({
      SomaStatus: 
        calculateHpStat({ base: HP, iv: HP_IV, ev: HP_EV, level: LEVEL }) +
        calculateStat({ base: ATTACK, iv: ATTACK_IV, ev: ATTACK_EV, level: LEVEL }) +
        calculateStat({ base: DEFENSE, iv: DEFENSE_IV, ev: DEFENSE_EV, level: LEVEL }) +
        calculateStat({ base: SP_ATK, iv: SP_ATK_IV, ev: SP_ATK_EV, level: LEVEL }) +
        calculateStat({ base: SP_DEF, iv: SP_DEF_IV, ev: SP_DEF_EV, level: LEVEL }) +
        calculateStat({ base: SPEED, iv: SPEED_IV, ev: SPEED_EV, level: LEVEL }),
      SomaIV: HP_IV + ATTACK_IV + DEFENSE_IV + SP_ATK_IV + SP_DEF_IV + SPEED_IV, 
      SomaEV: HP_EV + ATTACK_EV + DEFENSE_EV + SP_ATK_EV + SP_DEF_EV + SPEED_EV,  
      level: LEVEL
    }),
    hp: {
      base: HP,
      iv: HP_IV,
      ev: HP_EV,
      stat: calculateHpStat({ base: HP, iv: HP_IV, ev: HP_EV, level: LEVEL }),
      regenPercent: 2,
      regenDelay: 5,
    },
    energy: {
      stat: calculateEnergyStat({
        hp: calculateHpStat({ base: HP, iv: HP_IV, ev: HP_EV, level: LEVEL }),
        defense: calculateStat({ base: DEFENSE, iv: DEFENSE_IV, ev: DEFENSE_EV, level: LEVEL }),
        sp_def: calculateStat({ base: SP_DEF, iv: SP_DEF_IV, ev: SP_DEF_EV, level: LEVEL })
      }),
      regenPercent: 10,
      regenDelay: 3,
    },
    attack: {
      base: ATTACK,
      iv: ATTACK_IV,
      ev: ATTACK_EV,
      stat: calculateStat({ base: ATTACK, iv: ATTACK_IV, ev: ATTACK_EV, level: LEVEL }),
    },
    defense: {
      base: DEFENSE,
      iv: DEFENSE_IV,
      ev: DEFENSE_EV,
      stat: calculateStat({ base: DEFENSE, iv: DEFENSE_IV, ev: DEFENSE_EV, level: LEVEL }),
    },
    sp_atk: {
      base: SP_ATK,
      iv: SP_ATK_IV,
      ev: SP_ATK_EV,
      stat: calculateStat({ base: SP_ATK, iv: SP_ATK_IV, ev: SP_ATK_EV, level: LEVEL }),
    },
    sp_def: {
      base: SP_DEF,
      iv: SP_DEF_IV,
      ev: SP_DEF_EV,
      stat: calculateStat({ base: SP_DEF, iv: SP_DEF_IV, ev: SP_DEF_EV, level: LEVEL }),
    },
    speed: {
      base: SPEED,
      iv: SPEED_IV,
      ev: SPEED_EV,
      stat: calculateStat({ base: SPEED, iv: SPEED_IV, ev: SPEED_EV, level: LEVEL }),
    },
  },
  moves: [],
}
