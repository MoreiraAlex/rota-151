import IDLE_CLIP from './clips/idle.json'
import WALK_CLIP from './clips/walk.json'
import RUN_CLIP from './clips/run.json'
import CRY_CLIP from './clips/cry.json'

export const BULBASAUR = {
  id: 'bulbasaur',
  dexNumber: 1,
  kind: 'pokemon',
  model: {
    path: '/assets/models/001-bulbasaur.glb',
    scale: 0.012,
    texture: {
      0: { path: '/assets/textures/001-bulbasaur/default/pm0001_00_BodyA1.png' },
      2: { path: '/assets/textures/001-bulbasaur/default/pm0001_00_BodyB1.png' },
      3: {
        path: '/assets/textures/001-bulbasaur/default/pm0001_00_Eye1_Merged.png',
        flipY: false,
        center: { x: 0.5, y: 0.5 },
        repeat: { x: 1 / 4, y: 1 / 4 },
        rotation: 180,
        // Humor + piscar (ver docs/features/023-estado-de-humor-e-piscar-
        // de-olhos.md, `core/traits/components/mood.js`) — `open`/`closed`
        // são exatamente o que `pan` era antes (célula do atlas 4x4, em
        // unidades de célula), só que agora tem DUAS por estado; o
        // mecanismo alterna entre elas sozinho.
        // `awake.open` é a célula que já estava em uso (`pan` antigo, valor
        // conferido/correto). AS OUTRAS TRÊS SÃO PLACEHOLDER — ainda não
        // sei quais células do atlas são de verdade "olho fechado"/
        // "dormindo"/"braba" (decisão visual, só dá pra ver olhando o
        // atlas em `pm0001_00_Eye1_Merged.png`). `sleeping`/`angry` foram
        // deixados IGUAIS a `awake` de propósito — não quebra nem pisca
        // errado, só não muda de cara até você trocar pelos valores reais.
        eyeStates: {
          awake: {
            open: { x: -0.5, y: -0.25 },
            closed: { x: -0.5, y: 0.25 }, // PLACEHOLDER — ajustar
          },
          sleeping: {
            open: { x: -0.5, y: -0.25 },
            closed: { x: -0.25, y: -0.25 },
          },
          angry: {
            open: { x: 0, y: -0.25 },
            closed: { x: -0.5, y: 0.5 },
          },
        },
        blink: { minInterval: 2, maxInterval: 6, closedDuration: 0.15 },
      },
      4: { path: '/assets/textures/001-bulbasaur/default/pm0001_00_BodyB1.png' },
      5: { path: '/assets/textures/001-bulbasaur/default/pm0001_00_BodyB1.png' },
    },
  },

  clips: {
    idle: IDLE_CLIP,
    walk: WALK_CLIP,
    run: RUN_CLIP,
    cry: CRY_CLIP,
  },
  body: {
    capsuleRadius: 0.4,
    capsuleHalfHeight: 0.15,
    capsuleAxis: 'z',
    modelOffset: [0, -0.35, 0],
  },
  movement: {
    walkSpeed: 2,
    runSpeed: 6,
    turnSpeed: 10,
    jumpSpeed: 9,
  },
  vitals: {
    maxHp: 100,
    hpRegenPercent: 2,
    hpRegenDelayAfterDamage: 5,
    maxStamina: 100,
    staminaRegenPercent: 10,
    staminaRegenDelayAfterUse: 3,
    runStaminaDrainPerSecond: 2,
    jumpStaminaCost: 10,
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
  stats: {},
  moves: [],
}
