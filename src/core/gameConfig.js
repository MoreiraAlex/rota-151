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
    // Velocidade do ataque básico pelo status `speed` (ver
    // `calculateAttackDurationFactor`, core/data/species/stats.js): a
    // duração autorada (`basicAttack.duration`, ou a do
    // próprio ataque) é multiplicada por √(REFERENCE / speed), limitado a
    // [MIN_FACTOR, MAX_FACTOR]. REFERENCE é o `speed` CALCULADO (base + IV
    // + nível) que toca a duração autorada exata — 10 ≈ base 45 no nível 5
    // com IV médio (bulbasaur).
    ATTACK_SPEED: {
      REFERENCE: 10,
      MIN_FACTOR: 0.6,
      MAX_FACTOR: 1.4,
    },
    // Faixa de IV (individual value, convenção clássica de Pokémon)
    // sorteada pra QUALQUER criatura — selvagem, no spawn
    // (`wildCreatureSpawnSystem.js`), ou do time do jogador, ao
    // equipar (`core/actions/party.js`, `equiparCriatura`) — mesmo
    // range pros dois, IV é aleatório pra todo mundo (pedido do
    // usuário). Ver `rollIndividualValues`, `core/data/species/stats.js`.
    IV_MIN: 0,
    IV_MAX: 31,
    // Chance (0-1) de um ataque ser crítico (`critical = 2` na fórmula de
    // dano, ver `core/battle/calculateDamage.js`) — 1/16, mesma taxa
    // clássica das primeiras gerações de Pokémon. Decisão separada do
    // cálculo de dano em si (pedido do usuário), sorteada com
    // `gameplayRng` (`core/rng.js`) — regra 3.5, sem `Math.random()`.
    CRITICAL_HIT_CHANCE: 1 / 16,
    // Faixa do multiplicador aleatório de dano (`random` na fórmula),
    // mesma convenção clássica (85%-100%). Ver `rollDamageRandomFactor`.
    DAMAGE_RANDOM_MIN: 0.85,
    DAMAGE_RANDOM_MAX: 1,
    // Status ofensivo/defensivo usado no cálculo de dano quando a
    // espécie ainda não migrou pro formato `stats.<key>.base`
    // (`fox`/`wolf`/seus clones `fox-red/green/blue` — ver
    // `resolveCreatureStats`, `core/data/species/stats.js`). Sem isso,
    // um ataque dessas criaturas não causaria dano nenhum; com o
    // fallback, causa um dano neutro/mediano — mesmo "fallback
    // gracioso" que `resolveMaxHp`/`resolveMaxStamina` já usam pra essas
    // mesmas espécies.
    FALLBACK_COMBAT_STAT: 50,
    // Assistência de mira dos golpes corpo a corpo (`attack.aim:
    // 'melee'`, ver `core/battle/attackAim.js`): meio-ângulo (radianos)
    // do cone horizontal, em volta de pra onde a câmera aponta, onde um
    // alvo ao alcance e no mesmo plano de combate "puxa" o giro do golpe.
    // 45° = cone de 90° no total. Valor de partida, ajustar jogando.
    MELEE_AIM_HALF_ANGLE: Math.PI / 4,
    // Direcionar o golpe ENQUANTO O AVISO CARREGA: do disparo até o `effectAt`,
    // a criatura controlada acompanha a câmera (a direção só trava no instante
    // do golpe). `false` = trava no disparo, como antes. Só vale pra criatura
    // controlada (a IA mira uma vez, no disparo).
    ATTACK_WINDUP_STEERING: true,
    // Segundos sem lançar ataque até a criatura sair do modo combate
    // (`CombatMode`, `combatModeSystem.js`) — cada ataque reinicia a conta.
    COMBAT_MODE_TIMEOUT: 10,
    // Atordoamento (ação `'hit'`, `core/actions/hitStun.js`) de quem teve um
    // golpe de status interrompido por dano: segundos em que toca a animação
    // de hit e não faz nada. 0.67 = a `hit` dos iniciais na velocidade
    // original. Por espécie: `actions.hit.duration`.
    HIT_STUN_DURATION: 0.67,
    // Quanto tempo (s) o visual de cada drenagem do Leech Seed fica na cena
    // (`leechSeedSystem.js`, grupo `'leech-drain'`) — cobre os orbes indo do
    // alvo até quem plantou e o estouro no alvo.
    LEECH_DRAIN_EFFECT_DURATION: 1.6,
    // Combate 2.5D (`core/battle/attackGeometry.js`): diferença máxima
    // (m) entre as elevações dos pés de atacante e alvo, cada uma medida
    // em relação ao terreno logo abaixo dela. Acima disso, o alvo está
    // fora do plano de combate (ex.: pulando alto).
    MAX_COMBAT_HEIGHT_DIFF: 1.0,
    // Até onde (m) procurar o chão abaixo de uma criatura pra medir a
    // elevação dos pés — sem chão nesse alcance, conta como no chão.
    GROUND_PROBE_DISTANCE: 20,
    // Espaçamento (m) das amostras de terreno ao longo da trajetória do
    // golpe (`resolveAttackImpactPoint`, creatureAttackSystem.js) — o
    // golpe acompanha rampas e para em desnível/parede entre amostras.
    ATTACK_PATH_SAMPLE_STEP: 0.25,
  },
  // Retorno visual de combate (view — consome eventos de `core/events/`).
  FEEDBACK: {
    // Brilho rápido no modelo de quem foi atingido (`hitFlashSystem.js`): acende
    // na cor do acontecimento (`FEEDBACK_COLORS`, abaixo) e apaga ao longo de
    // DURATION (s). INTENSITY (0-1) é o quanto o brilho cobre a textura.
    HIT_FLASH: {
      DURATION: 0.15,
      INTENSITY: 0.8,
    },
    // Cores do feedback por LADO e por TIPO de acontecimento — a mesma paleta
    // pro brilho do modelo (`hitFlashSystem.js`) e pros textos acima da cabeça
    // (`damageNumberSystem.js` + `DamageNumbersView.jsx`):
    // - DAMAGE: tomou dano; CRIT: o número do dano CRÍTICO (o brilho do contorno
    //   continua na cor de DAMAGE); DEBUFF: status negativo (atributo baixou);
    //   BUFF: status positivo (atributo subiu).
    // - OPPONENT (selvagens e quem não é do jogador): vermelho / laranja / verde.
    // - ALLY (o treinador e as criaturas do time): tons frios — rosa / violeta /
    //   ciano —, pra bater o olho e saber de que lado foi.
    // Cor do texto "Errou!" (golpe que falhou no sorteio de precisão): cinza
    // claro, igual pros dois lados — não é dano nem status.
    MISS_COLOR: '#d9d9d9',
    // Cor do texto "Interrompido!" (golpe de status cortado na carga por
    // dano): amarelo, igual pros dois lados — não é dano nem status.
    INTERRUPT_COLOR: '#ffd54f',
    FEEDBACK_COLORS: {
      OPPONENT: {
        DAMAGE: '#ff3b30',
        CRIT: '#ffd23f',
        DEBUFF: '#ff9f0a',
        BUFF: '#32d74b',
      },
      ALLY: {
        DAMAGE: '#ff5c8a',
        CRIT: '#ffc4e1',
        DEBUFF: '#b57bff',
        BUFF: '#4dd0e1',
      },
    },
    // Número de dano subindo acima de quem apanhou (`damageNumberSystem.js`
    // + `DamageNumbersView.jsx`). Crítico fica mais tempo, maior e com
    // rótulo próprio (visual na view).
    DAMAGE_NUMBER: {
      // Quantos números podem estar na tela ao mesmo tempo — pool de
      // tamanho fixo (regra de efeito visual frequente); cheio, o mais
      // antigo é reaproveitado.
      POOL_SIZE: 24,
      // Segundos na tela (normal / crítico).
      LIFETIME: 0.9,
      CRIT_LIFETIME: 1.2,
      // Quanto (m) o número sobe ao longo da vida.
      RISE: 0.9,
      // Folga (m) acima do topo do corpo do alvo onde o número nasce.
      HEAD_MARGIN: 0.2,
      // Afastamento lateral (m) entre números seguidos no mesmo alvo, pra
      // golpes rápidos não empilharem um em cima do outro.
      SPREAD: 0.25,
    },
    // Indicador de alcance antes de lançar (`castMode: 'confirm'`,
    // `AttackIndicatorView.jsx`): leque azulado no chão, estilo LoL.
    ATTACK_INDICATOR: {
      FILL_COLOR: '#3fa9ff',
      FILL_OPACITY: 0.28,
      EDGE_COLOR: '#a6dcff',
      EDGE_OPACITY: 0.9,
      // Altura (m) acima do chão — evita o leque "piscar" dentro do chão.
      GROUND_LIFT: 0.03,
      // Desenha o leque por cima de tudo (sem teste de profundidade) — a
      // criatura não tampa mais a parte embaixo dela. Efeito colateral:
      // também aparece através de parede/obstáculo/terraço. `false` volta
      // ao normal (tampado por quem estiver na frente).
      ALWAYS_ON_TOP: true,
    },
    // Aviso de golpe (`view/scene/AttackTelegraphView.jsx`): durante a
    // execução de QUALQUER ataque (time e selvagens), o leque da área
    // aparece no chão e se preenche do ápice até a borda, completando no
    // instante do dano — dá pra ver onde vai acertar e desviar. Usa a
    // mesma altura (`GROUND_LIFT`) do indicador acima, mas respeita
    // profundidade (não é desenhado por cima de corpos/obstáculos).
    ATTACK_TELEGRAPH: {
      FILL_COLOR: '#ff7043',
      FILL_OPACITY: 0.35,
      EDGE_COLOR: '#ffab91',
      EDGE_OPACITY: 0.9,
      // Carga de golpe em SI MESMO (Growth): círculo nos pés, que ainda pode
      // ser interrompido por dano — cor própria, não o vermelho de ataque.
      SELF_FILL_COLOR: '#9ccc65',
      SELF_EDGE_COLOR: '#dcedc8',
      // Quantos avisos simultâneos no máximo (pool fixo de leques).
      POOL_SIZE: 16,
    },
    // Efeito visual do dash (`view/vfx/dashVfx.js`, `view/scene/
    // DashEffectsView.jsx`): linhas de velocidade enquanto dura o dash e poeira
    // no chão na saída. SCALE multiplica tamanho e raio (1 = o do Cobblemon, grande
    // pras criaturas daqui; valor de partida, ajustar jogando).
    DASH_EFFECT: {
      ENABLED: true,
      SCALE: 0.6,
      // Linhas de velocidade: quantas saem por SEGUNDO enquanto o dash dura
      // (vivem 0.2 s, então ~LINE_RATE × 0.2 na tela de cada vez; 0 = sem
      // linhas), e o tamanho de cada uma em metros, antes da escala.
      LINE_RATE: 25,
      LINE_LENGTH: 0.6,
      LINE_THICKNESS: 0.05,
      // Nuvens de poeira na saída do dash (0 = sem poeira).
      DUST_COUNT: 5,
    },
    // Poeira do pulo (`view/scene/JumpDustView.jsx`, `view/vfx/jumpDustVfx.js`):
    // anel de nuvens no chão na decolagem de um pulo (TAKEOFF_COUNT nuvens) e na
    // aterrissagem de qualquer queda — a quantidade vai de LANDING_COUNT_MIN a
    // _MAX conforme a velocidade da queda (m/s): abaixo de MIN_FALL_SPEED não
    // solta nada (degrau, rampa) e em MAX_FALL_SPEED é a força total. SCALE
    // multiplica tamanho e raio. Valores de partida, ajustar jogando.
    JUMP_DUST: {
      ENABLED: true,
      SCALE: 0.5,
      MIN_FALL_SPEED: 2,
      MAX_FALL_SPEED: 10,
      TAKEOFF_COUNT: 2,
      LANDING_COUNT_MIN: 2,
      LANDING_COUNT_MAX: 4,
    },
    // Hit stop (`view/systems/hitStopSystem.js`): no acerto, a ANIMAÇÃO
    // do atacante e do alvo congela por um instante — dá "peso" ao golpe.
    // Só visual (a simulação segue); ticks de ataque canalizado não
    // disparam (travaria o canal a cada tick).
    HIT_STOP: {
      DURATION: 0.07,
      CRIT_DURATION: 0.12,
    },
    // Anel de tempo da ação de ataque (`view/scene/ActionTimerRingView.jsx`),
    // estilo stamina do Valheim: no chão, em volta da criatura CONTROLADA,
    // só enquanto ela executa um ataque — começa cheio e esvazia até o fim
    // da `duration` (quando ela fica livre de novo).
    ACTION_TIMER_RING: {
      COLOR: '#ffd54f',
      OPACITY: 0.9,
      // Anel de fundo (a parte já gasta).
      TRACK_COLOR: '#000000',
      TRACK_OPACITY: 0.35,
      // Folga (m) entre o corpo (`capsuleRadius`) e a borda interna do anel.
      PADDING: 0.12,
      // Espessura (m) do anel.
      THICKNESS: 0.06,
      // Segmentos do círculo — mais = arco mais liso.
      SEGMENTS: 64,
    },
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
      DURATION: 0.5,
      // Unidades por segundo — maior que o runSpeed de qualquer espécie hoje.
      SPEED: 10,
      // Custo de stamina, descontado uma vez no disparo (não por segundo).
      STAMINA_COST: 1,
      // Frenagem (s): nos últimos EASE_OUT_TIME segundos, a velocidade desce
      // suave de SPEED até a de saída (0 / andar / correr, pelo input) em
      // vez de cair de uma vez no tick seguinte. Limitado a metade de
      // DURATION; 0 desliga. Ver `resolveDashSpeed` (playerActionSystem.js).
      EASE_OUT_TIME: 0.25,
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
  // Comportamento das selvagens em relação ao lado do jogador
  // (`wildBehaviorSystem.js`, `WildBehavior`). Distâncias no plano
  // horizontal, entre a selvagem e o alvo dela (treinador ou criatura do
  // time). Valores de partida.
  WILD_BEHAVIOR: {
    // Chance (0-1) de uma selvagem nascer hostil, pra espécie sem
    // `wild.hostileChance` própria.
    DEFAULT_HOSTILE_CHANCE: 0.5,
    // Hostil começa a perseguir quem chegar a esta distância (m)...
    AGGRO_RADIUS: 8,
    // ...e só desiste passando dela + esta folga — sem a folga, parado bem
    // na borda ela ficaria alternando entre perseguir e desistir.
    AGGRO_EXIT_MARGIN: 1,
    // Perseguindo, uma selvagem COM ataque básico para quando o alvo
    // estiver a esta fração do alcance do golpe (range + radius + raio do
    // corpo do alvo) — perto o bastante pra acertar com folga.
    ATTACK_REACH_FRACTION: 0.8,
    // Sem ataque básico configurado, para quando sobrar este vão (m) entre
    // os corpos (bordas das cápsulas).
    CHASE_STOP_GAP: 0.8,
    // Segundos entre um pedido de golpe e o próximo, perseguindo.
    ATTACK_INTERVAL: 1.2,
    // Pacífica que apanha: chance (0-1) de revidar; senão, foge.
    RETALIATE_CHANCE: 0.5,
    // Quem persegue porque APANHOU (pacífica revidando, ou hostil atacada
    // de longe) só desiste além desta distância (m).
    RETALIATE_LEASH_RADIUS: 14,
    // Fugindo: corre pra um ponto este tanto (m) à frente, na direção
    // oposta ao jogador (recalculado sempre)...
    FLEE_STEP: 6,
    // ...até ficar a esta distância (m); aí volta a vagar dali.
    FLEE_SAFE_DISTANCE: 14,
  },
  // IA das criaturas do time fora do controle do jogador — sempre
  // defensiva (`partyBehaviorSystem.js`, `PartyBehavior`): entra na luta
  // contra a selvagem que acertou alguém do grupo, só com o ataque básico.
  PARTY_BEHAVIOR: {
    // Segundos entre um pedido de golpe e o próximo. Mais lento que o
    // jogador de propósito: a IA ajuda, quem decide a luta é quem joga.
    ATTACK_INTERVAL: 1.5,
    // Para quando o alvo estiver a esta fração do alcance do próprio
    // ataque básico (mesma regra das selvagens, `WILD_BEHAVIOR`).
    ATTACK_REACH_FRACTION: 0.8,
    // Se afastou mais que isto (m, no plano) de quem segue (quem está no
    // controle), larga a luta e volta a seguir.
    LEASH_RADIUS: 15,
  },
  // Desmaio (`faintSystem.js`, `Fainted`): criatura (selvagem ou do time)
  // que chega a 0 de HP.
  FAINT: {
    // Minutos desmaiada (intangível, sem regenerar) até acordar. Vale pra
    // selvagem e pra do time (que conta mesmo depois de recolhida).
    DURATION_MINUTES: 15,
    // Fração (0-1) do HP máximo com que acorda.
    REVIVE_HP_FRACTION: 0.15,
    // Segundos desmaiada no chão antes do treinador recolher a do time.
    PARTY_RECALL_DELAY: 2,
  },

  ANIMATION: {
    // Abaixo disso, considera parado (idle).
    WALK_MIN_SPEED: 0.3,
    // Acima disso, considera correndo (run) em vez de andando (walk). Fica
    // entre walkSpeed e runSpeed de MovementStats (core/data/species).
    RUN_MIN_SPEED: 3,
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
    // TARGET_HEIGHT: 1.5,
    // Deslocamento lateral (m) do ponto que a câmera mira, em relação ao
    // alvo — usado tanto na resolução do ponto de mira (`computeAimRay`,
    // arremesso/esfera de invocar) quanto no enquadramento renderizado de
    // fato (`cameraFollowSystem.js`, sempre ativo): o retículo (fixo no
    // centro da tela) não se move, mas o personagem sai do centro, dando
    // o enquadramento "sobre o ombro" de verdade. 0 desativa o efeito por
    // completo (personagem sempre centralizado).
    // SHOULDER_OFFSET: 0.4,
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
