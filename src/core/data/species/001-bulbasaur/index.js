import IDLE_CLIP from './clips/idle.json'
import WALK_CLIP from './clips/walk.json'
import RUN_CLIP from './clips/run.json'
import CRY_CLIP from './clips/cry.json'
import { calculateAttackInterval, calculateCP, calculateEnergyStat, calculateHpStat, calculateStat } from '../stats'

// Nível fixo por ESPÉCIE — ver comentário completo em `../fox/index.js`.
// 5 = nível clássico de inicial em Pokémon de verdade. Extraído pra
// constante (em vez de só `level: 5` dentro do objeto) porque `stats`,
// abaixo, precisa do MESMO valor pra calcular `value` — um objeto
// literal não consegue ler `level` de um campo irmão durante a própria
// criação (ver docstring de `../stats.js`).
const LEVEL = 5

// IV (0-31, "individual") sorteado por STATUS — mesmo espírito de
// Pokémon de verdade, cada status tem o seu. Calculado aqui, numa
// variável de verdade, pelo mesmo motivo de `LEVEL`: não dá pra ler
// `hp.iv` de dentro de `hp.value` no mesmo objeto literal.
//
// Limitação conhecida, ainda não resolvida: `BULBASAUR` é um objeto
// ÚNICO, compartilhado por toda criatura desta espécie (`getSpecies
// ('bulbasaur')` sempre devolve a MESMA referência) — o `Math.random()`
// abaixo roda UMA VEZ, quando o módulo carrega, não uma vez por
// criatura. Na prática, hoje, todo Bulbasaur do jogo nasce com o
// MESMO IV "sorteado" (o de quem carregou o módulo primeiro), o que
// não é de verdade "individual". Resolver isso direito exige sortear
// IV por CRIATURA, no spawn (`partySummonSystem.js`/
// `wildCreatureSpawnSystem.js`), não na definição estática da espécie
// — fora do escopo desta correção (que só resolveu o `ReferenceError`
// mantendo a fórmula pedida); avisado, não resolvido.
const HP = 45
const ATTACK = 49
const DEFENSE = 65
const SP_ATK = 65
const SP_DEF = 45
const SPEED = 45

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
  // override nenhum ainda.
  attacks: {
    primary: { 
      id: 'vine-whip', 
      overrides: { 
        range: 1.8, 
        duration: calculateAttackInterval(calculateStat({ base: SPEED, iv: SPEED_IV, ev: SPEED_EV, level: LEVEL })),
        effectAt: calculateAttackInterval(calculateStat({ base: SPEED, iv: SPEED_IV, ev: SPEED_EV, level: LEVEL })) * 0.4
      } 
    },
    secondary1: 'razor-leaf',
  },
  // `value` calculado por `calculateHpStat`/`calculateStat`
  // (`../stats.js`) — a fórmula em si é a mesma que estava aqui antes,
  // só não dava pra `value` ler `base`/`iv`/`ev`/`level` como campo
  // IRMÃO dentro do mesmo objeto literal (`ReferenceError: base is not
  // defined` — um objeto literal não tem esse tipo de auto-referência
  // durante a própria criação). A fórmula dos status que NÃO são HP
  // também ganhou o `+ 5` que faltava (fórmula real de Pokémon:
  // `floor((floor(base...) + 5) * nature)`) — sem ele o número saía
  // sistematicamente mais baixo que o esperado.
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
