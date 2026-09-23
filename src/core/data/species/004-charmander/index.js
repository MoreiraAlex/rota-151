import IDLE_CLIP from './clips/idle.json'
import WALK_CLIP from './clips/walk.json'
import RUN_CLIP from './clips/run.json'
import CRY_CLIP from './clips/cry.json'

export const CHARMANDER = {
  id: 'charmander',
  dexNumber: 4,
  kind: 'pokemon',
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
  stats: {},
  moves: [],
}
