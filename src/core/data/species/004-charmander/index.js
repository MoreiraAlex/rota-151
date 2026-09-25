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
const HP = 39
const ATTACK = 52
const DEFENSE = 43
const SP_ATK = 60
const SP_DEF = 50
const SPEED = 65

// EV — 0 pra todo status por enquanto (sistema de treino ainda não
// existe; pedido do usuário: "EVs 0 para todos, no futuro vou
// modificando o EV de cada atributo para os meus pokemons").
const HP_EV = 0
const ATTACK_EV = 0
const DEFENSE_EV = 0
const SP_ATK_EV = 0
const SP_DEF_EV = 0
const SPEED_EV = 0

export const CHARMANDER = {
  id: 'charmander',
  dexNumber: 4,
  // Nível fixo por ESPÉCIE — ver comentário completo em `../fox/index.js`.
  level: LEVEL,
  kind: 'pokemon',
  sprite: { path: 'https://play.pokemonshowdown.com/sprites/ani/charmander.gif' },
  model: {
    path: '/assets/models/004-charmander.glb',
    scale: 0.015,
    texture: {
      0: { 
        path: '/assets/textures/004-charmander/default/pm0004_00_Eye1.png',
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
      1: { path: '/assets/textures/004-charmander/default/pm0004_00_Body1.png' },
    },
  },

  clips: {
    idle: IDLE_CLIP,
    walk: WALK_CLIP,
    run: RUN_CLIP,
    cry: CRY_CLIP,
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
        '/assets/audio/voices/004-charmander/cry-01.wav',
        '/assets/audio/voices/004-charmander/cry-02.wav',
        '/assets/audio/voices/004-charmander/cry-03.wav',
      ],
      volume: 0.8,
      refDistance: 2,
      minInterval: 4,
      maxInterval: 32,
    },
    dashGroup: 'default',
    jumpGroup: 'default',
  },
  // Fogo de partícula na ponta da cauda (ver docs/features/022-fogo-de-
  // cauda-do-charmander.md) — encaixado no osso `Tail6`
  // (`TAIL_BONE_BY_SPECIES`, `useAnimatedModel.js`), acompanha a animação
  // sozinho. `width`/`height`/`density` bem menores que o default de
  // `createFlame` (calibrado pra uma fogueira ~1 unidade) — uma chama de
  // cauda é bem menor, ver `view/vfx/flameParticles.js`.
  vfx: {
    tailFire: {
      shape: 'cone',
      width: 0.05,
      height: 2,
      density: 1,
      turbulence: 0,
      scale: 0.3,
      // Rotação LOCAL fixa (graus) por cima da orientação herdada do osso
      // — o fogo saía "deitado" na cauda porque `bone.add()` também herda
      // a orientação de repouso do rig, não só a posição (ver
      // tailFireSystem.js). Ajusta x/y/z olhando o resultado no jogo.
      rotation: { x: 90, y: 0, z: 0 },
      // Deslocamento LOCAL (unidades de mundo) a partir da origem do osso
      // — ajusta na mão se a chama não nascer exatamente onde deveria em
      // relação à ponta da cauda (ver tailFireSystem.js).
      position: { x: 0.1, y: 0, z: 0 },
      // Luz de verdade (`THREE.PointLight`, filha do mesmo grupo — já
      // acompanha escala/rotação/posição acima de graça, ver docstring de
      // `createFlame` em flameParticles.js). `distance` bem menor que o
      // default de fogueira (3) — chama de cauda não devia iluminar uma
      // área grande.
      light: {
        color: '#ff8a3d',
        distance: 8,
        decay: 0.2,
        baseIntensity: 5,
        // Sombra dinâmica (cubemap de PointLight, mais caro que uma luz
        // sem sombra) — liga pra ver o Charmander/objetos por perto
        // reagirem ao flicker da chama.
        castShadow: false,
      },
    },
  },
  // Quais ataques/skills — ver docs/features/025-ataque-comum-de-
  // criatura.md e o comentário completo em `../fox/index.js`. `range`
  // sobrescrito pra 1 (menor que o `1.4` da definição base de
  // `'scratch'`) — corpo pequeno do Charmander, alcance mais curto fica
  // proporcional. Exemplo real de override por criatura, ver
  // `core/data/attacks/_template/index.js`.
  // `secondary1` (tecla Q, 9ª rodada) — Brasa (`core/data/attacks/ember/
  // index.js`), sem override nenhum ainda.
  // SEM `duration`/`effectAt` no `primary` — calculados por INDIVÍDUO
  // a partir do `speed` de cada criatura (`creatureAttackSystem.js`,
  // `resolvePrimaryDurationOverride`), não mais um literal fixo desta
  // espécie (ver docs/features/029-*.md).
  attacks: {
    primary: {
      id: 'scratch',
      overrides: {
        range: 1,
        visual: {
          rotationOffset: { x: 0, y: 0, z: -15 },
        },
      },
    },
    secondary1: 'ember',
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
