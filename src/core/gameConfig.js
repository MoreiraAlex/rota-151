/**
 * Configuração central do jogo.
 *
 * Toda constante ajustável e GENÉRICA (igual pra qualquer entidade —
 * zoom de câmera, gravidade, algoritmo do character controller) vive
 * aqui, agrupada por domínio. Config que varia POR ESPÉCIE (velocidade,
 * vitals, e — desde docs/features/018-troca-de-controle-treinador-
 * criatura.md — custos/delays de stamina/HP e o que é exclusivo do
 * treinador: arremesso/consumo/invocar/recolher/comportamento de time)
 * mora em `core/data/species/<id>/index.js`, não aqui. Systems leem
 * daqui — nunca declaram números mágicos.
 */
export const GAME_CONFIG = {
  LOOP: {
    // Passo fixo da simulação (60 Hz).
    FIXED_TIMESTEP: 1 / 60,
    // Teto de tempo absorvido por frame. Protege contra "spiral of death"
    // quando a aba fica em background ou ocorre um stall de GC.
    MAX_FRAME_TIME: 0.25,
    // Teto de passos fixos por frame. Backlog além disso é descartado.
    MAX_STEPS_PER_FRAME: 5,
  },
  WORLD: {
    SEED: 151,
  },
  // Ver docs/rules/README.md, 3.5 — sem `Math.random()` em lógica de
  // jogo, PRNG seedado e nomeado. `core/rng.js` (`gameplayRng`) usa
  // `WORLD.SEED` acima como seed.
  BATTLE: {
    // Faixa de IV (individual value, convenção clássica de Pokémon)
    // sorteada pra QUALQUER criatura — selvagem, no spawn
    // (`wildCreatureSpawnSystem.js`), ou do time do jogador, ao
    // equipar (`core/actions/party.js`, `equiparCriatura`) — mesmo
    // range pros dois, IV é aleatório pra todo mundo (pedido do
    // usuário). Ver `rollIndividualValues`, `core/data/species/stats.js`.
    IV_MIN: 0,
    IV_MAX: 31,
  },
  // Modo scanner (item categoria `scanner`, ex.: Pokédex) —
  // `scannerModeSystem.js`, docs/features/031-*.md/032-*.md. Genérico
  // (não por espécie de item) porque só o treinador escaneia, mesmo
  // raciocínio de `PLAYER_ACTIONS.dash` abaixo.
  SCANNER: {
    // Alcance (m) do raycast que acha a criatura embaixo do retículo.
    RANGE: 5,
  },
  // Só `dash` continua aqui — funciona igual pra qualquer entidade
  // controlada (treinador ou criatura, ver docs/features/018-troca-de-
  // controle-treinador-criatura.md), sem variar por espécie. Arremesso,
  // consumo, invocar/recolher e o comportamento de time (antes `PARTY`
  // aqui) viraram config exclusiva do TREINADOR — só ele dispara essas
  // ações de verdade — em `core/data/species/bot/index.js`
  // (`actions`/`party`), lidos via `getPlayerSpecies()`
  // (`core/data/species/index.js`).
  PLAYER_ACTIONS: {
    dash: {
      // Duração do impulso (segundos).
      DURATION: 0.4,
      // Unidades por segundo — maior que o runSpeed de qualquer espécie hoje.
      SPEED: 12,
      // Custo de stamina, descontado uma vez no disparo (não por segundo).
      STAMINA_COST: 5,
    },
  },
  // Grade de navegação usada por `core/pathfinding.js` pra contornar
  // obstáculos do `TEST_LEVEL` em vez de andar em linha reta — ver
  // `creatureFollowSystem.js`.
  PATHFINDING: {
    // Tamanho (m) de cada célula da grade — grade cobre
    // `TEST_LEVEL.ground.size / CELL_SIZE` células por eixo.
    CELL_SIZE: 1,
    // Margem (m) somada ao contorno de cada obstáculo antes de marcar
    // células como não-andáveis — evita a cápsula da criatura raspar
    // quina de obstáculo (a grade só sabe de células inteiras).
    OBSTACLE_MARGIN: 0.4,
    // Segundos entre recálculos de caminho por criatura — recalcular todo
    // tick é desperdício (o treinador não se move tão rápido assim) e
    // deixa a trajetória mais nervosa.
    REPATH_INTERVAL: 0.5,
    // Distância (m) até um waypoint pra considerá-lo alcançado e avançar
    // pro próximo.
    WAYPOINT_ARRIVAL_DISTANCE: 0.5,
    // Diferença de elevação (m) entre células vizinhas (incluindo
    // diagonais) acima da qual vira "penhasco" intransponível sem rampa —
    // ver "Elevação (heightmap)" em core/pathfinding.js. Precisa ficar
    // entre o degrau por célula de uma rampa normal (~0.48m com os
    // ângulos usados no nível de teste) e o salto de um terraço sem rampa
    // (1.8m na trilha de teste) — senão ou bloqueia rampas de verdade, ou
    // deixa passar de um andar pro outro sem rampa nenhuma.
    MAX_CLIMB_STEP: 0.6,
    // Distância máxima (m) de um único salto suavizado do caminho
    // (`boundedSmoothPath` em core/pathfinding.js) — mesmo que um trecho
    // reto inteiro seja andável célula a célula, virar UM waypoint só bem
    // longe (a trilha de teste inteira, por exemplo, cabe numa lane de só
    // ~4m de largura) dá tempo demais pra criatura desviar da lane antes
    // da próxima correção (giro suavizado por `turnSpeed`, física) — ela
    // acaba esbarrando de lado numa rampa (ou passando por baixo dela) em
    // vez de subir. Maior que distâncias comuns em campo aberto (mantém o
    // comportamento de sempre pra esses casos, um waypoint só até o alvo),
    // bem menor que o comprimento de um atalho perigoso atravessando
    // vários terraços/rampas.
    MAX_SHORTCUT_DISTANCE: 8,
    // Distância (m) dos dois raycasts laterais de evasão local — ver
    // `MovementBlocked` em `characterPhysicsSystem.js`/
    // `creatureFollowSystem.js`. Só usado no tick em que a criatura está
    // travada, pra escolher entre desviar à esquerda ou à direita.
    AVOIDANCE_PROBE_DISTANCE: 1.5,
  },
  // `wildWanderSystem.js` — genérico pra qualquer `WildCreature`, não varia
  // por espécie (ver docs/features/020-fox-selvagens-cena-e-texturas.md).
  WILD_WANDER: {
    // Raio (m) em torno do ponto de spawn (`WanderState.homeX/homeZ`) onde
    // um novo destino pode ser sorteado — mantém cada criatura vagando por
    // uma área local, não atravessando o mapa inteiro.
    RADIUS: 12,
    // Segundos parada ao chegar num destino, antes de sortear o próximo
    // (sorteado de novo a cada vez, entre os dois).
    MIN_PAUSE: 3,
    MAX_PAUSE: 8,
    // Distância (m) até o destino atual pra considerá-lo alcançado.
    ARRIVAL_DISTANCE: 0.6,
    // Segundos perseguindo o mesmo destino sem chegar antes de desistir e
    // sortear outro — trava de segurança contra destino praticamente
    // inalcançável (ver docstring de `WanderState.chaseTimer`).
    MAX_CHASE_TIME: 15,
  },
  ANIMATION: {
    // Abaixo disso, considera parado (idle).
    WALK_MIN_SPEED: 0.3,
    // Acima disso, considera correndo (run) em vez de andando (walk). Fica
    // entre walkSpeed e runSpeed de MovementStats (core/data/species).
    RUN_MIN_SPEED: 5,
    // Duração do crossfade (segundos) ao trocar de AnimationState — evita o
    // corte seco entre idle/walk/run (ou qualquer outro clipe futuro).
    BLEND_DURATION: 0.2,
  },
  PHYSICS: {
    // Aceleração da gravidade (m/s²). Mais forte que 9.81 dá um "peso" de jogo.
    GRAVITY: -30,
    // Parâmetros do algoritmo do character controller — compartilhados por
    // todo mundo (existe um único KinematicCharacterController do Rapier no
    // world inteiro, ver physicsWorld.js). Tamanho de cápsula e velocidades
    // (andar/correr/girar/pular) NÃO ficam aqui — são por espécie, ver
    // `core/data/species/<id>/index.js` (`body`/`movement`), copiados nos
    // traits CharacterController/MovementStats no spawn.
    CHARACTER: {
      // "Casca" do character controller (folga de colisão).
      CONTROLLER_OFFSET: 0.03,
      // Inclinação máxima que sobe / mínima em que escorrega (radianos).
      MAX_SLOPE_CLIMB: 0.9,
      MIN_SLOPE_SLIDE: 0.6,
      // Auto-degrau: altura e largura mínima do degrau transposto sozinho.
      AUTOSTEP_HEIGHT: 0.4,
      AUTOSTEP_MIN_WIDTH: 0.15,
      // Distância de "colar no chão" ao descer.
      SNAP_TO_GROUND: 0.4,
      // Velocidade vertical mantida enquanto no chão (mantém o snap ativo) —
      // epsilon técnico do algoritmo, não atributo de criatura.
      GROUNDED_STICK: -2,
      // Sinal de "tem algo sólido na frente que não era esperado" — ver
      // trait `MovementBlocked`. Só entra na conta quando o deslocamento
      // PEDIDO neste tick (Velocity * delta, no plano XZ) já passa dessa
      // distância mínima (m) — evita marcar bloqueado por causa de ruído
      // quando a entidade já está quase parada (pedido ~0, qualquer
      // razão real/pedido vira instável).
      MIN_BLOCKED_CHECK_DISTANCE: 0.01,
      // Razão (deslocamento real / pedido, no plano XZ) abaixo da qual
      // marca `MovementBlocked`. Baixo de propósito — deslizar ao longo
      // de uma parede em ângulo (o KCC já faz isso, mantém progresso) não
      // deve contar como bloqueado, só um estancamento quase total.
      BLOCKED_MOVEMENT_RATIO: 0.15,
    },
  },
  CAMERA: {
    // Órbita inicial em torno do alvo.
    INITIAL_YAW: 0,
    INITIAL_PITCH: 0.35,
    INITIAL_DISTANCE: 12,
    // Limite do ângulo vertical (pitch), em radianos. O horizontal (yaw) é
    // livre. `pitch` positivo põe a câmera ACIMA do alvo olhando pra baixo
    // (MAX_PITCH ~1.35 rad ≈ 77°, quase de cima); `pitch` 0 é olhar reto,
    // no nível do alvo. Pra olhar pra CIMA (céu, algo alto à frente), a
    // câmera precisa descer ABAIXO do alvo e inclinar — isso é `pitch`
    // NEGATIVO, não perto de zero (um MIN_PITCH só um pouco acima de 0
    // nunca deixa passar do "olhar reto", por menor que seja — foi o que
    // limitava antes). MIN_PITCH ~-0.6 rad ≈ -34° dá uma boa folga pra
    // cima. Ajuste à vontade.
    MIN_PITCH: -0.5,
    MAX_PITCH: 1.35,
    // Limites do zoom, em unidades.
    MIN_DISTANCE: 2.5,
    MAX_DISTANCE: 25,
    // Radianos por pixel de movimento do mouse (pointer lock).
    MOUSE_SENSITIVITY: 0.0025,
    // Unidades de distância por "notch" de scroll.
    ZOOM_SPEED: 1.5,
    // Fator de suavização do acompanhamento (maior = mais rígido).
    SMOOTHING: 12,
    // Altura do ponto de mira acima da origem do alvo.
    TARGET_HEIGHT: 1.5,
    // Deslocamento lateral (m) do ponto que a câmera mira, em relação ao
    // alvo — usado tanto na resolução do ponto de mira (`computeAimRay`,
    // arremesso/esfera de invocar) quanto no enquadramento renderizado de
    // fato (`cameraFollowSystem.js`, sempre ativo): o retículo (fixo no
    // centro da tela) não se move, mas o personagem sai do centro, dando
    // o enquadramento "sobre o ombro" de verdade. 0 desativa o efeito por
    // completo (personagem sempre centralizado).
    SHOULDER_OFFSET: 0.4,
    // Colisão da câmera orbital (docs/backlog.md → "Câmera orbital com
    // colisão"): raycast do alvo até a posição desejada da câmera; batendo
    // em algo antes de `orbit.distance`, a câmera aproxima pra logo antes
    // do ponto de impacto em vez de atravessar. COLLISION_MARGIN é a folga
    // (m) mantida antes da superfície (senão a câmera encostaria bem em
    // cima dela). MIN_DISTANCE_AFTER_COLLISION é o piso de quão perto do
    // alvo a colisão pode empurrar a câmera — independente de MIN_DISTANCE
    // (que só limita o zoom manual), porque encurralado num canto a câmera
    // precisa poder chegar bem mais perto do que o zoom mínimo normal.
    COLLISION_MARGIN: 0.3,
    MIN_DISTANCE_AFTER_COLLISION: 0.5,
    // Câmera do modo Scan (item categoria `scanner`, botão direito
    // SEGURADO — ver `view/systems/cameraFollowSystem.js`,
    // `core/systems/scannerModeSystem.js`, docs/features/033-*.md) —
    // seção própria, separada da câmera orbital de terceira pessoa
    // acima (nada aqui afeta o comportamento fora do modo Scan). Sem
    // zoom (removido — o usuário testou e não gostou do comportamento,
    // pediu de volta só o essencial): dois parâmetros, um offset fixo
    // e os limites de pitch.
    SCAN: {
      // Deslocamento FIXO da câmera pra FRENTE (na direção que ela
      // olha, `computeOrbitForward`) — único posicionamento que este
      // modo tem. Pedido do usuário: "o problema atual é que, quando o
      // personagem se movimenta... partes da própria malha acabam
      // aparecendo/vazando na câmera... uma solução simples é
      // posicionar a câmera um pouco à frente da posição atual dela...
      // não quero uma solução baseada em esconder partes do model, a
      // ideia é resolver isso pelo posicionamento da câmera". `0` =
      // sem deslocamento (câmera na posição "olho" pura — bem
      // provável que veja o próprio pescoço/cabelo do model);
      // positivo empurra pra frente do modelo. Valor de partida — sem
      // navegador neste sandbox, ajustar ao vivo (menu de pausa →
      // Configurações) até nenhuma parte do model aparecer, inclusive
      // nos extremos de PITCH_MIN/PITCH_MAX abaixo.
      CAMERA_OFFSET_FORWARD: 1.2,
      // Limites do pitch (ângulo vertical) só neste modo — independente
      // de MIN_PITCH/MAX_PITCH acima (terceira pessoa continua com o
      // range de sempre). Mesma convenção de sinal de MIN_PITCH/
      // MAX_PITCH (ver comentário acima).
      PITCH_MIN: -0.5,
      PITCH_MAX: 1,
    },
  },
  // Sem seção AUDIO aqui de propósito — volume/alcance/intervalo de som
  // (passo, voz, ambiente) moram todos junto do PRÓPRIO som que
  // descrevem (grupo/espécie em core/data/audio/footstepGroups.js/
  // voiceSound.js, nível em core/data/testLevel.js/ambientSound.js) —
  // nenhum é um número genérico igual pra tudo, então nenhum fica aqui.
  // Ver docs/features/019-som-ambiente-e-passos.md.
}
