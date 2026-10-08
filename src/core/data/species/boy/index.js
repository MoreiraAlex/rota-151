import IDLE_CLIP from './clips/idle.json'
import WALK_CLIP from './clips/walk.json'
import RUN_CLIP from './clips/run.json'
import THROW_CLIP from './clips/throw.json'
import RECALL_CLIP from './clips/recall.json'
import FALL_CLIP from './clips/fall.json'
import ROLL_CLIP from './clips/roll.json'

// Olho do treinador — atlas `tr0001_00_eye_col_99.png`: o rosto inteiro
// (os dois olhos) numa célula de 1/2 x 1/4, uma variação por linha na
// metade esquerda (bravo, aberto, fechado); o resto é só pele. Os UVs dos
// dois olhos no `.glb` caem no quarto de baixo; `rotation: 180` + o
// `offset` de cada estado levam o recorte pra linha certa. Usado nos DOIS
// materiais de olho (senão só um pisca).
const EYE_TEXTURE = {
  path: '/assets/textures/boy/default/tr0001_00_eye_col_99.png',
  flipY: false,
  center: { x: 0.5, y: 0.5 },
  repeat: { x: 1, y: 1 },
  rotation: 180,
  eyeStates: {
    awake: {
      open: { x: -0.5, y: 0.25 },
      closed: { x: -0.5, y: 0.5 },
    },
    angry: {
      open: { x: -0.5, y: -0.01 },
      closed: { x: -0.5, y: 0.5 },
    },
    // `sleeping` — o nome do humor em `Mood` (estava `sleep`, nunca batia).
    sleeping: {
      open: { x: -0.5, y: 0.5 },
      closed: { x: -0.5, y: 0.5 },
    },
    faint: {
      open: { x: -0.5, y: 0.5 },
      closed: { x: -0.5, y: 0.5 },
    },
  },
  // Irmão de `eyeStates` (dentro dele virava um "humor" e era ignorado).
  blink: { minInterval: 2, maxInterval: 6, closedDuration: 0.15 },
}

export const BOY = {
  id: 'boy',
  dexNumber: null,
  // Sem `level` de propósito — a etiqueta acima da cabeça
  // (`view/scene/NameplateView.jsx`, docs/features/027-hud-de-status-e-habilidades.md) mostra nome/nível/vida/stamina pra QUALQUER entidade,
  // incluindo o treinador, mas "nível" não faz sentido nenhum pra um
  // humano — o campo é opcional, `level` ausente simplesmente não
  // aparece na etiqueta (mesmo fallback gracioso de sempre).
  kind: 'trainer',
  sprite: { path: 'https://play.pokemonshowdown.com/sprites/trainers/red.png' },
  level: 1,
  xp: { current: 50, max: 100 },
  model: {
    path: '/assets/models/boy.glb',
    scale: 0.015,
    texture: {
      0: { path: '/assets/textures/boy/default/tr0001_00_skin_col_99.png' },
      // Os dois olhos: material 1 = olho esquerdo (`Leye`), 2 = direito
      // (`Reye`) — mesma textura e a mesma config (ver `EYE_TEXTURE`).
      1: EYE_TEXTURE,
      2: EYE_TEXTURE,
      3: { path: '/assets/textures/boy/default/tr0001_00_hair_col_99.png' },
      4: { path: '/assets/textures/boy/default/tr0001_00_cap_col_99.png' },
      6: { path: '/assets/textures/boy/default/tr0001_00_skin_col_99.png' },
      7: { path: '/assets/textures/boy/default/tr0001_00_skin_col_99.png' },
      8: { path: '/assets/textures/boy/default/tr0001_00_tops_col_99.png' },
      9: { path: '/assets/textures/boy/default/tr0001_00_bottoms_col_99.png' },
      10: { path: '/assets/textures/boy/default/tr0001_00_shoes_col_99.png' },
      11: { path: '/assets/textures/boy/default/tr0001_00_bag_col_99.png' },
    },
  },
  clips: {
    idle: IDLE_CLIP,
    walk: WALK_CLIP,
    run: RUN_CLIP,
    throw: THROW_CLIP,
    recall: RECALL_CLIP,
    fall: FALL_CLIP,
    dash: ROLL_CLIP,
  },
  // Onde fica a fruta enquanto come (docs/features/042-itens-da-beta.md,
  // `view/systems/eatingFoodViewSystem.js`) — ver `_template/`.
  vfx: {
    eatFood: {
      hands: ['RHand'],
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: 1,
    },
  },
  body: {
    capsuleRadius: 0.3,
    capsuleHalfHeight: 0.7,
    capsuleAxis: 'y',
    modelOffset: [0, -1, 0],
  },
  movement: {
    walkSpeed: 2.25,
    runSpeed: 6,
    turnSpeed: 10,
    jumpSpeed: 9,
  },
  camera: {
    targetHeight: 1.2,
    shoulderOffset: 0,
  },
  // Números próprios do treinador (não luta — fora da fórmula das criaturas,
  // docs/features/035-balanceamento-de-acoes-e-correcoes.md), na barra dele:
  vitals: {
    // Stamina gasta por segundo enquanto realmente correndo.
    runStaminaDrainPerSecond: 3.2,
    // Custo de stamina do pulo, descontado uma vez no disparo.
    jumpStaminaCost: 4,
    // Custo do dash, descontado uma vez no disparo.
    dashStaminaCost: 8,
  },
  // Exclusivo do treinador (`getPlayerSpecies()`, ver
  // core/data/species/index.js) — arremesso/consumo/invocar/recolher só
  // ele dispara de verdade (item/Party de verdade só existem nele), então
  // não faz sentido uma criatura declarar isso (ver `_template/index.js`).
  actions: {
    throw: {
      // Duração total da ação (segundos) — precisa bater com a duração de
      // verdade do clipe de animação de arremesso (`clips/throw.json`):
      // clipes de AÇÃO (não cíclicos) usam `speed` como `1/duração`
      // (mesma leitura de "ciclos/segundo" dos clipes de locomoção, mas
      // aqui vira "a ação inteira é 1 ciclo" — ver a skill
      // procedural-rig-animation, referências/animations/one-shot-
      // actions.md): duração = 1 / `speed` do clipe. Errar esse valor
      // (maior que o real) faz o gesto reiniciar do início e ficar
      // visivelmente "engasgado" antes de cortar pro idle — o motor
      // não trava o clipe no fim (`loop: false` no JSON é só documentação,
      // não é lido em lugar nenhum), ele só repete o mesmo gesto fechado.
      duration: 0.3,
      // Instante (dentro da duração) em que o projétil é de fato spawnado —
      // não é keyframe de clipe, é config da própria ação (ver
      // docs/features/014-arremessar-usar-e-invocar.md). Devia coincidir
      // com o frame em que a MÃO solta o objeto no clipe de animação —
      // isso não dá pra derivar só do `speed` (fica na forma da curva, não
      // no número) — ajustado de olho no jogo, pela soltura visual.
      effectAt: 0.2,
      // Origem do arremesso (de onde a trajetória sai e onde o projétil
      // nasce) — aproxima a posição da MÃO a partir de `Position`/
      // `Rotation.y` do jogador, já que o motor não tem acesso ao osso de
      // verdade daqui (isso é conteúdo da view — ver
      // `view/systems/heldItemViewSystem.js`, que só cuida do visual
      // encaixado no osso, não da trajetória/spawn). Componentes somados
      // na direção que o corpo encara (`handForwardOffset`, à frente) e à
      // direita dele (`handSideOffset`) — mesma convenção de forward/right
      // usada em todo o resto (`computeCameraRight`, `movementSystem.js`).
      // `handHeightOffset` substitui o antigo "+1" fixo.
      handForwardOffset: 0.1,
      handSideOffset: 0.05,
      handHeightOffset: -0.02,
      // Velocidade do projétil (m/s). Ainda global por item — só existe um
      // throwable de teste hoje; migra pra config por item quando um
      // segundo precisar de velocidade diferente.
      speed: 45,
      // Segundos até o projétil desaparecer sozinho, mesmo já tendo
      // atingido algo (congelado no ponto do impacto até então).
      lifetime: 1.5,
      // Alcance máximo (m) do raycast de mira, a partir da câmera — nada
      // encontrado dentro dessa distância, mira no ponto mais distante
      // dessa distância mesmo (em vez de mirar no infinito).
      aimRange: 30,
      // Custo de stamina, descontado uma vez no disparo (não por segundo) —
      // mesmo padrão do dash. Sem stamina suficiente, o arremesso
      // simplesmente não dispara.
      staminaCost: 2,
    },
    consume: {
      // Duração total da ação (segundos).
      duration: 0.4,
      // Instante em que o efeito do item (cura, ver `item.consumable`) é
      // de fato aplicado.
      effectAt: 0.2,
      // Quanto tempo o efeito visual de partículas (ConsumeEffect) fica na
      // cena depois de spawnado — independente da duração da ação em si.
      effectVisualDuration: 0.6,
    },
    // Invocar/recolher criatura de time (ver `partySummonSystem.js` e
    // docs/features/017-locomocao-e-recolhimento-de-criaturas.md) — mesmo
    // padrão de ação com duração/efeito-no-meio de dash/throw/consume.
    summon: {
      // Duração total da ação (segundos) — trava movimento e qualquer
      // outra ação até terminar.
      duration: 0.5,
      // Instante em que a `SummonBall` é lançada (ver docs/features/024-
      // esfera-de-invocar.md) — a `SummonedCreature` só nasce de verdade
      // depois, quando a esfera pousa.
      effectAt: 0.35,
      // Origem do lançamento da esfera (de onde a trajetória sai e onde
      // ela de fato nasce) — mesmo mecanismo de `actions.throw`
      // (`resolveHandOrigin`, `core/aim.js`): aproxima a posição da MÃO a
      // partir de `Position`/`Rotation.y`, em vez de nascer no centro do
      // corpo. Valores próprios (não os de `throw`) — podem divergir se um
      // dia a pose de segurar a esfera parecer diferente da de arremessar
      // um item.
      handForwardOffset: 0.1,
      handSideOffset: 0.05,
      handHeightOffset: -0.02,
      // Quanto tempo o clarão de abertura (`SummonFlash`) fica na cena
      // depois da criatura nascer — independente da duração da ação em
      // si (a esfera normalmente ainda está pousando bem depois da ação
      // já ter destravado o treinador).
      flashDuration: 0.35,
    },
    recall: {
      // Duração total da ação (segundos).
      duration: 0.6,
      // Instante em que a `SummonedCreature` de fato é destruída.
      effectAt: 0.3,
      // Origem do feixe/da esfera (de onde o `RecallBeam` "sai") — papel
      // DUPLO, ver docstring de `RecallBeamView.jsx`:
      // 1) FALLBACK (`resolveHandOrigin(pos, rot.y, RECALL)` em
      //    `applyRecall`, `core/aim.js`) — usado no instante do disparo e
      //    sempre que o osso de verdade da mão (`RHand`, ver
      //    `view/handBoneBySpecies.js`) ainda não foi resolvido: aproxima a
      //    posição da MÃO a partir de `Position`/`Rotation.y` do treinador,
      //    em vez de nascer no centro do corpo. Nesse papel, precisa exceder
      //    `capsuleRadius` (ver `body` acima) com folga pra não ficar afundado na
      //    cápsula — valores bem maiores que uma AJUSTE fino, ver item 2.
      // 2) AJUSTE FINO por cima do osso resolvido (`RecallBeamView.jsx`,
      //    `resolveHandOrigin(ORIGIN, rot.y, RECALL)` — zera a posição de
      //    base, sobra só o vetor de deslocamento) — na prática, o
      //    caminho normal (osso quase sempre resolvido), então valores
      //    PEQUENOS aqui (frações de metro, não a magnitude do papel 1)
      //    pra só "cutucar" a esfera/o feixe um pouco em relação à mão de
      //    verdade, não posicioná-los do zero.
      // Valores próprios (não os de `throw`/`summon`) — podem divergir se
      // um dia o gesto de recolher parecer diferente dos outros dois.
      handForwardOffset: 0.1,
      handSideOffset: 0.05,
      handHeightOffset: -0.02,
      // Quanto tempo o feixe de luz (`RecallBeam`) fica na cena depois de
      // disparado. A aparência dele é `GAME_CONFIG.FEEDBACK.PHASE_BEAM`.
      beamDuration: 0.35,
    },
  },
  // Comportamento de "seguir o treinador" de toda criatura de time — ver
  // `creatureFollowSystem.js` e docs/features/017-locomocao-e-
  // recolhimento-de-criaturas.md. Exclusivo do treinador pelo mesmo motivo
  // de `actions` acima: é sempre em relação a QUEM TEM `Party`.
  party: {
    // Distância MÁXIMA (m, ao longo do CAMINHO percorrido, não em linha
    // reta da origem) que a `SummonBall` percorre antes de "desistir" e
    // pousar de qualquer jeito, na direção resolvida da MIRA — câmera,
    // já com a inclinação/pitch (ver docs/features/024-esfera-de-
    // invocar.md) — se ela tocar em algo no caminho (chão/obstáculo), a
    // criatura nasce ali, mais perto.
    summonOffset: 50,
    // Velocidade (m/s) da `SummonBall` em voo — sofre gravidade
    // (`GAME_CONFIG.PHYSICS.GRAVITY`, mesma constante do resto do jogo),
    // então a trajetória curva sozinha, ao contrário de
    // `actions.throw.speed`/`Projectile` (reto, sem gravidade).
    summonBallSpeed: 45,
    // Distância mínima (m) que a criatura mantém do treinador — não chega
    // mais perto que isso, pra não empilhar em cima dele.
    followMinDistance: 4,
    // Distância (m) além da qual a criatura corre (`runSpeed`, por
    // espécie DELA) em vez de andar (`walkSpeed`) pra alcançar o
    // treinador. Entre `followMinDistance` e este valor, anda; abaixo de
    // `followMinDistance`, parada.
    runDistance: 6,
    // Folga (histerese) entre as faixas acima — sem ela, a decisão
    // parada/anda/corre virava a cada tick em cima de um limiar só (com o
    // treinador andando entre o andar e o correr da criatura, ela fica no
    // limite e alterna). Parada, só volta a andar acima desta
    // distância; correndo, só volta a andar abaixo dela. Entre
    // `followMinDistance` e `runDistance`. Ver `resolveFollowGait`
    // (`creatureFollowSystem.js`).
    followResumeDistance: 5,
    // Distância (m) abaixo da qual outro personagem (treinador ou outra
    // criatura) conta como "muito perto" — soma repulsão na direção de
    // movimento pra desviar ANTES de esbarrar de verdade (personagens
    // colidem fisicamente de propósito, ver core/physics/colliders.js —
    // isso aqui evita precisar chegar nesse ponto). Maior que a soma dos
    // raios de duas cápsulas típicas.
    avoidanceRadius: 2.5,
    // Histerese do desvio PARADA (mesmo motivo de `followResumeDistance`):
    // parada, só começa a se afastar com alguém mais perto que isto, e
    // continua até ninguém estar dentro de `avoidanceRadius`. Sem a folga,
    // com outro chegando devagar ela andava um tick, saía do raio, parava,
    // ele entrava de novo — mini-passos. Menor que `avoidanceRadius`.
    avoidanceStartRadius: 2,
    // Peso da repulsão de `avoidanceRadius` em relação à direção principal
    // (waypoint/treinador, sempre vetor unitário) — cada vizinho próximo
    // soma até este tanto na direção final antes de normalizar.
    avoidanceStrength: 1.2,
  },
  // Ver core/data/audio/footstepGroups.js — `footstepGroup` compartilha
  // som/volume/alcance com qualquer outra espécie do mesmo grupo (aqui,
  // passo pesado de bípede). Uma espécie que precisar de som PRÓPRIO usa
  // `sounds: { footstep: { walk: [...], run: [...] } }` em vez disso (ver
  // `_template/index.js`).
  sounds: {
    footstepGroup: 'medium',
    // Sem `voice` ainda — mecanismo pronto (ver core/data/audio/
    // voiceSound.js e as iniciais pro formato de verdade em uso), só
    // falta um arquivo de vocalização do treinador. Sem este campo, o
    // treinador simplesmente não vocaliza (fallback gracioso).
    // Mesmo princípio de grupo de `footstepGroup` acima, ver
    // core/data/audio/dashSound.js/jumpSound.js.
    dashGroup: 'default',
    jumpGroup: 'default',
    // Som de invocar/recolher criatura — mecanismo pronto (ver
    // core/data/audio/summonSound.js/recallSound.js, docs/features/023-
    // estado-de-humor-e-piscar-de-olhos.md, seção "Som de invocar/
    // recolher"), só falta o arquivo de verdade. Sem
    // grupo (ao contrário de dash/pulo/passo) — só o treinador usa isso,
    // não há espécie nenhuma pra compartilhar com. Toca no instante em
    // que a criatura de fato aparece/some (`effectAt` da ação, não o
    // disparo — ver `actions.summon`/`actions.recall` acima), não no
    // clique do botão.
    //
    // Upload: `public/assets/audio/summon/summon-01.<ext>` (uma ou mais
    // variações, `-01`/`-02`/...) e `public/assets/audio/recall/
    // recall-01.<ext>` — mesma convenção de pasta que dash/pulo já usam
    // (`public/assets/audio/dash/default/`, `.../jump/default/`), só sem
    // o subnível "default" (sem grupo aqui). Descomenta e ajusta os
    // caminhos/quantidade de variações quando os arquivos existirem:
    summon: {
      clips: ['/assets/audio/summon/summon-01.wav'],
      volume: 0.4, // opcional, default 0.6 (DEFAULT_ACTION_SOUND_VOLUME)
      refDistance: 1, // opcional, default 6 (DEFAULT_ACTION_SOUND_REF_DISTANCE)
    },
    recall: {
      clips: ['/assets/audio/recall/recall-01.wav'],
      volume: 0.4,
      refDistance: 1,
    },
  },
  stats: {
    hp: {
      stat: 100,
      regenPercent: 2,
      regenDelay: 5,
    },
    energy: {
      stat: 80,
      regenPercent: 10,
      regenDelay: 3,
    },
  },
  moves: [],
}
