import IDLE_CLIP from './clips/idle.json'
import WALK_CLIP from './clips/walk.json'
import RUN_CLIP from './clips/run.json'
import CRY_CLIP from './clips/cry.json'

const LEVEL = 5

// BASE — único valor de `stats` fixo por ESPÉCIE (pedido do usuário:
// "BASE é o único que vai ser fixo por espécie"). IV não mora mais
// aqui — é sempre sorteado por INDIVÍDUO (`IndividualValues`/
// `PartyIndividualValues`), nunca um literal fixo — ver
// docs/features/029-*.md.
const HP = 44
const ATTACK = 48
const DEFENSE = 65
const SP_ATK = 50
const SP_DEF = 64
const SPEED = 43

// EV — 0 pra todo status por enquanto (sistema de treino ainda não
// existe; pedido do usuário: "EVs 0 para todos, no futuro vou
// modificando o EV de cada atributo para os meus pokemons").
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
          angry: {
            open: { x: 0, y: 0 },
            closed: { x: 0.5, y: 0.75 },
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
    runStaminaDrainPerSecond: 0.25,
    jumpStaminaCost: 1,
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
  // SEM `duration`/`effectAt` no `primary` — calculados por INDIVÍDUO
  // a partir do `speed` de cada criatura (`creatureAttackSystem.js`,
  // `resolvePrimaryDurationOverride`), não mais um literal fixo desta
  // espécie (ver docs/features/029-*.md).
  attacks: {
    primary: { id: 'punch', overrides: { range: 1 } },
    secondary1: 'whirlpool',
  },
  // `base`/`ev` daqui + o IV sorteado por indivíduo (congelado no
  // spawn/equipar, ver docs/features/029-*.md) é o que forma o status
  // de VERDADE de cada criatura, sempre calculado na hora por
  // `resolveCreatureStats` (`../stats.js`) — nada pré-calculado aqui.
  stats: {
    hp: { base: HP, ev: HP_EV, regenPercent: 2, regenDelay: 5 },
    energy: { regenPercent: 45, regenDelay: 2 },
    attack: { base: ATTACK, ev: ATTACK_EV },
    defense: { base: DEFENSE, ev: DEFENSE_EV },
    sp_atk: { base: SP_ATK, ev: SP_ATK_EV },
    sp_def: { base: SP_DEF, ev: SP_DEF_EV },
    speed: { base: SPEED, ev: SPEED_EV },
  },
  moves: [],
}
