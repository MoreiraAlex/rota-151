import IDLE_CLIP from './clips/idle.json'
import WALK_CLIP from './clips/walk.json'
import RUN_CLIP from './clips/run.json'
import CRY_CLIP from './clips/cry.json'

// Nível fixo por ESPÉCIE — ver comentário completo em `../fox/index.js`.
// 5 = nível clássico de inicial em Pokémon de verdade.
const LEVEL = 5

// BASE — único valor de `stats` fixo por ESPÉCIE (convenção clássica
// de Pokémon; pedido do usuário: "BASE é o único que vai ser fixo por
// espécie"). IV não mora mais aqui — é sempre sorteado por INDIVÍDUO
// (`IndividualValues`/`PartyIndividualValues`, `core/data/species/
// stats.js` + `core/actions/party.js`), nunca um literal fixo — ver
// docs/features/029-*.md.
const HP = 45
const ATTACK = 49
const DEFENSE = 65
const SP_ATK = 65
const SP_DEF = 45
const SPEED = 45

// EV — 0 pra todo status por enquanto (sistema de treino ainda não
// existe; pedido do usuário: "EVs 0 para todos, no futuro vou
// modificando o EV de cada atributo para os meus pokemons" — quando
// esse sistema existir, é aqui que cada valor passa a ser ajustado).
const HP_EV = 0
const ATTACK_EV = 0
const DEFENSE_EV = 0
const SP_ATK_EV = 0
const SP_DEF_EV = 0
const SPEED_EV = 0


export const BULBASAUR = {
  id: 'bulbasaur',
  dexNumber: 1,
  level: LEVEL,
  kind: 'pokemon',
  sprite: { path: 'https://play.pokemonshowdown.com/sprites/ani/bulbasaur.gif' },
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
  // Quais ataques/skills — ver docs/features/025-ataque-comum-de-
  // criatura.md e o comentário completo em `../fox/index.js`. `range`
  // sobrescrito pra 1.8 (maior que o `1.4` da definição base de
  // `'punch'`) — vinhas/chicotes de Bulbasaur combinam com um alcance
  // maior. Exemplo real de override por criatura, ver `core/data/
  // attacks/_template/index.js`. `secondary1` (tecla Q, 9ª rodada) —
  // Chicote de Videira (`core/data/attacks/vine-whip/index.js`), sem
  // override nenhum ainda. SEM `duration`/`effectAt` aqui — pro
  // `primary`, os dois são calculados por INDIVÍDUO a partir do
  // `speed` de cada criatura (`creatureAttackSystem.js`,
  // `resolvePrimaryDurationOverride`), não mais um literal fixo desta
  // espécie (ver docs/features/029-*.md).
  attacks: {
    primary: { id: 'vine-whip', overrides: { range: 1.8 } },
    secondary1: 'razor-leaf',
  },
  // `base`/`ev` daqui + o IV sorteado por indivíduo (congelado no
  // spawn/equipar — `IndividualValues`/`PartyIndividualValues`, ver
  // docs/features/029-*.md) é o que forma o status de VERDADE de cada
  // criatura desta espécie, sempre calculado na hora por
  // `resolveCreatureStats` (`../stats.js`) — nada aqui é pré-calculado
  // mais (sem `iv`/`stat`/`cp`, diferente de antes).
  stats: {
    hp: { base: HP, ev: HP_EV, regenPercent: 2, regenDelay: 5 },
    energy: { regenPercent: 10, regenDelay: 3 },
    attack: { base: ATTACK, ev: ATTACK_EV },
    defense: { base: DEFENSE, ev: DEFENSE_EV },
    sp_atk: { base: SP_ATK, ev: SP_ATK_EV },
    sp_def: { base: SP_DEF, ev: SP_DEF_EV },
    speed: { base: SPEED, ev: SPEED_EV },
  },
  moves: [],
}
