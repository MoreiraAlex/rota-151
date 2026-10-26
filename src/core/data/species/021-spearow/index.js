import CRY_CLIP from './clips/cry.json'
import WALK_CLIP from './clips/walk.json'
import RUN_CLIP from './clips/run.json'
import STUNNED_CLIP from './clips/stunned.json'
import { LGPE_EYE_ATLAS } from '../lgpeEyeAtlas'

const LEVEL = 5

const HP = 40
const ATTACK = 60
const DEFENSE = 30
const SP_ATK = 31
const SP_DEF = 31
const SPEED = 70

const HP_EV = 0
const ATTACK_EV = 0
const DEFENSE_EV = 0
const SP_ATK_EV = 0
const SP_DEF_EV = 0
const SPEED_EV = 0

// Modelo do Let's Go (o Spearow não está no dump do Legends: Z-A), pelo
// scripts/blender/convert-pokemon-lgpe.py. No LGPE ele voa no mapa: o andar e
// o correr do dump são voo, trazidos para perto do chão (voo rasante), e
// ficam só para o voo livre. No chão ele anda a pé: `clips.walk`/`clips.run`
// são o andar e o correr do Pidgey (Z-A) medidos e passados para este
// esqueleto como curvas (docs/features/060-ajustes-por-especie.md). Parado,
// fica de pé com a asa fechada. Não tem animação de dormir (o `rest` cai no
// idle) nem dash. O piscar é por textura (`eyeStates`), como no LGPE.
export const SPEAROW = {
  id: 'spearow',
  dexNumber: 21,
  level: LEVEL,
  baseXp: 52,
  growthRate: 'medium-fast',
  capture: { rate: 255 },
  kind: 'pokemon',
  types: ['normal', 'flying'],
  sprite: {
    path: 'https://play.pokemonshowdown.com/sprites/ani/spearow.gif',
  },
  model: {
    path: '/assets/models/021-spearow.glb',
    scale: 1.2,
    texture: {
      0: {
        path: '/assets/textures/021-spearow/default/pm0021_00_00_body_a_alb.png',
        flipY: false,
      },
      1: {
        path: '/assets/textures/021-spearow/default/pm0021_00_00_body_b_alb.png',
        flipY: false,
      },
      2: {
        path: '/assets/textures/021-spearow/default/pm0021_00_00_eye_alb.png',
        flipY: false,
        ...LGPE_EYE_ATLAS,
      },
      // asas fechadas: malhas à parte, com a textura das penas
      3: {
        path: '/assets/textures/021-spearow/default/pm0021_00_00_body_b_alb.png',
        flipY: false,
      },
      4: {
        path: '/assets/textures/021-spearow/default/pm0021_00_00_body_b_alb.png',
        flipY: false,
      },
    },
  },

  clips: {
    // Paralisado (atordoado): o modelo não tem `stun`, então o tremor de
    // choque por cima do `idle` (preview "Tremor de Paralisia").
    stunned: STUNNED_CLIP,
    cry: CRY_CLIP,
    walk: WALK_CLIP,
    run: RUN_CLIP,
  },
  // Sem `walk`/`run` aqui: no chão tocam os clipes procedurais acima.
  nativeAnimations: {
    roar: 'roar',
    idle: 'idle',
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
    // Voo livre (docs/features/060-ajustes-por-especie.md, Parte 2): o
    // voo rasante do `.glb` (`walk`/`run` do dump).
    flyIdle: 'flyIdle',
    fly: 'walk',
    flyFast: 'run',
    flyDash: 'run',
    battleIdle: 'battleIdle',
    appeal: 'appeal',
    hit: 'hit',
  },

  // Sem mãos: come do chão, embaixo do bico.
  vfx: {
    eatFood: {
      ground: 'LowerBeak',
      position: { x: 0, y: -0.05, z: 0.1 },
      rotation: { x: 90, y: 0, z: 90 },
      scale: 1,
    },
  },
  actions: {
    appeal: { duration: 1.6 },
  },

  body: {
    capsuleRadius: 0.12,
    capsuleHalfHeight: 0.06,
    capsuleAxis: 'y',
    modelOffset: [0, -0.18, 0],
    trigger: { radius: 0.2, halfLength: 0, angle: 0, offset: { x: 0, z: 0 } },
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
    speed: 4,
    fastSpeed: 9,
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
      clips: ['/assets/audio/voices/021-spearow/cry-01.wav'],
      volume: 0.8,
      refDistance: 2,
      minInterval: 4,
      maxInterval: 32,
    },
    dashGroup: 'default',
    jumpGroup: 'default',
  },
  skills: {
    1: 'peck',
    2: 'growl',
    3: 'leer',
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
    { id: 'peck' },
    {
      id: 'growl',
      overrides: {
        audio: {
          cry: false,
          clips: ['/assets/audio/voices/021-spearow/cry-01.wav'],
          volume: 2,
          refDistance: 4,
        },
      },
    },
    { id: 'leer' },

    { id: 'assurance', requires: { level: 8 } },
    { id: 'fury-attack', requires: { level: 11 } },
  ],
  // Na série ele é territorial e agressivo, ao contrário do Pidgey: ataca
  // quem entra no território dele.
  wild: { hostileChance: 0.6 },
}
