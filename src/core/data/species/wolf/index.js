import IDLE_CLIP from './clips/idle.json'
import WALK_CLIP from './clips/walk.json'
import RUN_CLIP from './clips/run.json'

/**
 * Fox (Khronos Sample Assets) — modelo livre usado como placeholder de
 * Pokémon/criatura selvagem (`kind: 'pokemon'`), não é o jogador — o avatar
 * de verdade do treinador é `bot/` (`PLAYER_SPECIES_ID`). Fica no registro
 * de espécies com o mesmo esquema de model/clips/stats que uma criatura real
 * terá, pra continuar servindo de cobaia de motor (animação procedural,
 * cápsula deitada de quadrúpede) até haver conteúdo de criatura de verdade.
 * Sem prefixo numérico de dex — não é um Pokémon de verdade.
 */
export const WOLF = {
  id: 'wolf',
  dexNumber: null,
  // Placeholder de criatura selvagem, não o treinador — ver comentário
  // acima. `resolveActionSlots('pokemon')` já resolve `primary` como
  // ataque comum (ver `attacks.primary` abaixo, docs/features/025-ataque-
  // comum-de-criatura.md) — `secondary1-3` continuam sem resolver (Q/E/R
  // reservados pras skills futuras, ver docs/features/018-troca-de-
  // controle-treinador-criatura.md).
  kind: 'pokemon',
  model: {
    path: '/assets/models/fox-debug.glb',
    scale: 0.015,
    // Extraída do próprio `.glb` (único material/textura do modelo) pra
    // dar pra editar por fora — ver docs/features/020-fox-selvagens-cena-
    // e-texturas.md. `flipY: false` porque essa textura em específico
    // segue a convenção de UV do glTF (de onde foi extraída) — oposta ao
    // default do projeto (`true`, ver `textureCache.js`), que assume o
    // caso mais comum hoje (arquivo de rip independente).
    texture: { 0: { path: '/assets/textures/wolf/wolf.png', flipY: false } },
  },
  clips: {
    idle: IDLE_CLIP,
    walk: WALK_CLIP,
    run: RUN_CLIP,
  },
  body: {
    // Cápsula de colisão: altura total = 2 * (capsuleRadius + capsuleHalfHeight).
    capsuleRadius: 0.4,
    capsuleHalfHeight: 0.45,
    // 'y' = em pé; 'x'/'z' deitam a cápsula pra corpo alongado na horizontal
    // (quadrúpede). Com esses valores (quase uma esfera) não faz diferença
    // visível ainda, mas espécies com corpo mais alongado vão precisar de
    // 'x' ou 'z' — ver core/traits/components/physics.js.
    capsuleAxis: 'z',
    // Onde o model é renderizado em relação ao centro da cápsula (offset
    // local, em unidades de mundo — não escala com `model.scale`). Ajusta
    // aqui toda vez que capsuleRadius/capsuleHalfHeight/capsuleAxis mudam,
    // pra manter o modelo visualmente alinhado com o collider.
    modelOffset: [0, -0.4, 0],
  },
  movement: {
    // Unidades por segundo (1 unidade = 1 metro).
    walkSpeed: 4,
    runSpeed: 10,
    // Fator de suavização do giro em direção ao movimento (rad/s aprox.).
    turnSpeed: 10,
    // Velocidade vertical inicial do pulo (m/s).
    jumpSpeed: 9,
  },
  vitals: {
    maxHp: 100,
    // % do máximo regenerado por segundo (enquanto não está no delay pós-dano).
    hpRegenPercent: 2,
    // Segundos sem regenerar HP depois de tomar dano.
    hpRegenDelayAfterDamage: 5,
    maxStamina: 100,
    staminaRegenPercent: 10,
    // Segundos sem regenerar stamina depois do último uso (correr/dash/pulo).
    staminaRegenDelayAfterUse: 3,
    // Stamina gasta por segundo enquanto realmente correndo.
    runStaminaDrainPerSecond: 2,
    // Custo de stamina do pulo, descontado uma vez no disparo.
    jumpStaminaCost: 10,
  },
  // Ver core/data/audio/footstepGroups.js — `footstepGroup` compartilha
  // som/volume/alcance com qualquer outra espécie do mesmo grupo (aqui,
  // passo leve de quadrúpede pequeno). `fox-red`/`fox-green`/`fox-blue`
  // herdam este mesmo grupo por spread (`{...FOX, id: ...}`).
  sounds: {
    footstepGroup: 'medium',
    // Vocalização periódica (ver core/data/audio/voiceSound.js) —
    // independente de andar/correr, toca a cada 10-25s (sorteado de novo
    // a cada vez), variação aleatória entre as duas amostras.
    voice: {
      clips: [
        '/assets/audio/voices/fox/cry-01.wav',
        '/assets/audio/voices/fox/cry-02.wav',
      ],
      volume: 0.8,
      refDistance: 2,
      minInterval: 4,
      maxInterval: 32,
    },
    // Mesmo princípio de grupo de `footstepGroup` acima, ver
    // core/data/audio/dashSound.js/jumpSound.js.
    dashGroup: 'default',
    jumpGroup: 'default',
  },
  // Quais ataques/skills — ver docs/features/025-ataque-comum-de-
  // criatura.md e o comentário completo em `../fox/index.js`. Sem
  // override — os valores da definição base de `'scratch'`
  // (`core/data/attacks/scratch/index.js`) já servem.
  attacks: {
    primary: 'scratch',
  },
  stats: {},
  moves: [],
}
