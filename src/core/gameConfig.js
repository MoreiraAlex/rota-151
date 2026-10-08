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
    // Passo fixo da simulação (s).
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
    // Velocidade dos golpes pelo status `speed` (ver
    // `calculateAttackDurationFactor`, core/data/species/stats.js): a
    // duração autorada da skill (`duration`/`effectAt`) e a recarga são
    // multiplicadas por √(REFERENCE / speed), limitado a
    // [MIN_FACTOR, MAX_FACTOR]. REFERENCE é o `speed` CALCULADO (base + IV
    // + nível) que toca a duração autorada exata.
    ATTACK_SPEED: {
      REFERENCE: 10,
      MIN_FACTOR: 0.6,
      MAX_FACTOR: 1.4,
    },
    // Faixa de IV (individual value, convenção clássica de Pokémon)
    // sorteada pra QUALQUER criatura — selvagem, no spawn
    // (`wildCreatureSpawnSystem.js`), ou do jogador, ao criar o
    // registro (`core/actions/pokemon.js`, `criarPokemon`) — mesmo
    // range pros dois, IV é aleatório pra todo mundo (pedido do
    // usuário). Ver `rollIndividualValues`, `core/data/species/stats.js`.
    IV_MIN: 0,
    IV_MAX: 31,
    // Chance (0-1) de um ataque ser crítico (`critical = 2` na fórmula de
    // dano, ver `core/battle/calculateDamage.js`). Decisão separada do
    // cálculo de dano em si (pedido do usuário), sorteada com
    // `gameplayRng` (`core/rng.js`) — regra 3.5, sem `Math.random()`.
    CRITICAL_HIT_CHANCE: 1 / 16,
    // Faixa do multiplicador aleatório de dano (`random` na fórmula). Ver
    // `rollDamageRandomFactor`.
    DAMAGE_RANDOM_MIN: 0.85,
    DAMAGE_RANDOM_MAX: 1,
    // Status ofensivo/defensivo usado no cálculo de dano quando a
    // espécie ainda não migrou pro formato `stats.<key>.base` (ver
    // `resolveCreatureStats`, `core/data/species/stats.js`). Sem isso,
    // um ataque dessas criaturas não causaria dano nenhum; com o
    // fallback, causa um dano neutro/mediano — mesmo "fallback
    // gracioso" que `resolveMaxHp`/`resolveMaxStamina` já usam pra essas
    // mesmas espécies.
    FALLBACK_COMBAT_STAT: 50,
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
    // de hit e não faz nada. Por espécie: `actions.hit.duration`.
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
  // Tipos elementais (docs/features/039-tipos-e-combate-classico.md). A tabela de
  // efetividade, com os próprios multiplicadores, fica em
  // `core/data/types/index.js`; aqui só o bônus do golpe do mesmo tipo de
  // quem ataca (STAB, `resolveStab`).
  TYPES: {
    STAB_MULTIPLIER: 1.5,
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
    // Visual da Pokébola de captura (docs/features/043-captura.md,
    // `view/captureBallMotion.js`):
    // - SPIN_SPEED: giro (voltas/s) da bola em voo.
    // - WOBBLE_*: cada balançada inclina a bola de lado e volta, WOBBLE_CYCLES
    //   vezes em WOBBLE_DURATION (s), até WOBBLE_ANGLE (graus), amortecendo.
    // - GLOW_*: o brilho que puxa o selvagem pra dentro (cresce e some
    //   durante a absorção), até GLOW_MAX_SCALE × o tamanho da bola.
    // - STAR_*: estrelinhas do "Capturado!" — STAR_COUNT saindo até
    //   STAR_DISTANCE (m) em volta da bola.
    // - CLICK_*: o "clique" no fim — a bola encolhe CLICK_SQUASH e volta.
    // - POP_DURATION: o selvagem estourando a bola no escape (s).
    // - BREAK_*: a bola que errou quebra nos últimos BREAK_DURATION (s),
    //   em BREAK_PIECES pedaços.
    CAPTURE_BALL: {
      SPIN_SPEED: 2.5,
      WOBBLE_ANGLE: 45,
      WOBBLE_CYCLES: 3,
      WOBBLE_DURATION: 0.9,
      GLOW_COLOR: '#ff4d4d',
      GLOW_MAX_SCALE: 6,
      STAR_COUNT: 6,
      STAR_DISTANCE: 0.45,
      STAR_COLOR: '#ffe066',
      CLICK_SQUASH: 0.15,
      POP_DURATION: 0.2,
      BREAK_DURATION: 0.3,
      BREAK_PIECES: 6,
      BREAK_COLOR: '#d9d9d9',
    },
    // Partículas da Pokébola do Cobblemon (`view/vfx/pokeballVfx.js`): a bola
    // abrindo (invocar, escape) e o "Capturado!". ENABLED liga/desliga;
    // SCALE multiplica o tamanho e as distâncias do efeito inteiro.
    POKEBALL_VFX: {
      ENABLED: true,
      SCALE: 1,
    },
    // O feixe da Pokébola (recolher, invocar, captura puxando o selvagem —
    // `view/scene/RecallBeamView.jsx`), no estilo do Cobblemon: a textura
    // `phase_beam.png` correndo ao longo dele (SCROLL_SPEED, repetições
    // por segundo), tingida com a cor da bola (`pokeball.beamColor`, ou
    // DEFAULT_COLOR). Miolo de raio RADIUS (m) e opacidade OPACITY; brilho
    // em volta de raio GLOW_RADIUS e opacidade GLOW_OPACITY. O "envelope" da
    // criatura entrando/saindo usa ENVELOPE_OPACITY.
    PHASE_BEAM: {
      DEFAULT_COLOR: '#ff3b3b',
      RADIUS: 0.035,
      GLOW_RADIUS: 0.09,
      OPACITY: 0.95,
      GLOW_OPACITY: 0.35,
      SCROLL_SPEED: 3,
      ENVELOPE_OPACITY: 0.75,
    },
    // Cores dos textos da captura (docs/features/043-captura.md):
    // "Capturado!", "Escapou!" e "Pelas costas!".
    CAPTURED_COLOR: '#7cf29c',
    ESCAPED_COLOR: '#ff9e80',
    BACK_STRIKE_COLOR: '#ffe066',
    // Cores da mira da Pokébola: o arco/retículo normal, pegando um
    // selvagem e fora do alcance.
    AIM_COLOR: '#ffffff',
    AIM_TARGET_COLOR: '#ff4d4d',
    AIM_OUT_OF_RANGE_COLOR: '#8a8a8a',
    // Cor do texto "+N XP" em cima da criatura do time que ganhou XP
    // (docs/features/037-experiencia-e-nivel.md).
    XP_COLOR: '#9fd8ff',
    // Cor do texto "Nível N!" quando ela sobe de nível.
    LEVEL_UP_COLOR: '#ffe066',
    // Cor do texto "Falhou!" (golpe que não erra, falhando por domínio
    // baixo — docs/features/038-aprendizado-treino-e-dominio-de-golpes.md).
    FAIL_COLOR: '#c9b8a6',
    // Cor dos avisos de golpe: "Pode aprender X!", "Aprendeu X!".
    MOVE_NOTICE_COLOR: '#b9f6ca',
    // Cores dos textos de efetividade de tipo (docs/features/039-tipos-e-combate-classico.md), iguais pros dois lados: "Super efetivo!", "Pouco
    // efetivo…" e "Não afeta…".
    // Cor do selo de cada condição de status (HUD/etiqueta) e do texto dela
    // no log.
    CONDITION_COLORS: {
      burn: '#e8590c',
    },
    EFFECTIVENESS_COLORS: {
      super: '#ff8a3d',
      weak: '#9fb3c8',
      immune: '#8c8c8c',
    },
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
    // Log de batalha em texto, estilo jogo de turno (`battleLogSystem.js` +
    // `tools/hud/BattleLogHud.jsx`, docs/features/039-tipos-e-combate-classico.md).
    BATTLE_LOG: {
      // Quantas linhas ficam guardadas/visíveis (as mais antigas saem).
      MAX_LINES: 7,
      // Segundos sem mensagem nova até o log apagar (volta na próxima).
      IDLE_FADE_TIME: 8,
      // Cor do "X usou Y!".
      USED_COLOR: '#ffffff',
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
    // no chão na saída. SCALE multiplica tamanho e raio (1 = o do Cobblemon).
    DASH_EFFECT: {
      ENABLED: true,
      SCALE: 0.6,
      // Linhas de velocidade: quantas saem por SEGUNDO enquanto o dash dura
      // (0 = sem linhas), e o tamanho de cada uma em metros, antes da escala.
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
    // Fruta sendo comida (docs/features/042-itens-da-beta.md,
    // `view/systems/eatingFoodViewSystem.js` e `view/scene/
    // EatingVfxView.jsx`). A cada mordida (a cada BITE_INTERVAL s, ou quando
    // o pedaço do modelo troca) a fruta dá um "aperto" (achata BITE_SQUASH e
    // volta numa mola de rigidez BITE_SPRING), pula BITE_HOP (m, só a do
    // chão) e solta JUICE_COUNT gotas de suco e CRUMB_COUNT farelos. Enquanto
    // come, brilhos de cura sobem em volta de quem come (HEAL_SPARKLE_RATE
    // por segundo). A fruta caída respinga ao quicar (LAND_JUICE_COUNT).
    // SCALE multiplica o tamanho das partículas. Valores de partida,
    // ajustar jogando.
    EAT_FOOD: {
      ENABLED: true,
      BITE_INTERVAL: 0.7,
      BITE_SQUASH: 0.22,
      BITE_SPRING: 300,
      BITE_HOP: 0.04,
      JUICE_COUNT: 5,
      CRUMB_COUNT: 3,
      HEAL_SPARKLE_RATE: 6,
      LAND_JUICE_COUNT: 4,
      SCALE: 1,
    },
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
  // ações de verdade — em `core/data/species/boy/index.js`
  // (`actions`/`party`), lidos via `getPlayerSpecies()`
  // (`core/data/species/index.js`).
  // Corrida e dash custam mais energia com a vida baixa — pra todo mundo
  // (jogador, time, selvagens; `resolveMovementCostMultiplier`,
  // core/actions/stamina.js): × 1 com a vida cheia até × MAX_MULTIPLIER com
  // ela em 0, pela curva (1 - vida) ^ EXPONENT.
  STAMINA_BY_HP: {
    MAX_MULTIPLIER: 8,
    EXPONENT: 2,
  },
  // Andar e correr ficam mais lentos com a vida baixa — pra todo mundo
  // (`resolveSpeedMultiplier`, core/actions/movementSpeed.js): × 1 com a vida
  // cheia até × MIN_MULTIPLIER com ela em 0, pela curva (1 - vida) ^ EXPONENT.
  // Não vale pro dash.
  SPEED_BY_HP: {
    MIN_MULTIPLIER: 0.6,
    EXPONENT: 2,
  },
  PLAYER_ACTIONS: {
    dash: {
      // Duração do impulso (segundos).
      DURATION: 0.5,
      // Unidades por segundo — maior que o runSpeed de qualquer espécie hoje.
      SPEED: 10,
      // Recarga (s) depois de cada dash — igual pra todos, jogador e IA
      // (`DashCooldown`, docs/features/035-balanceamento-de-acoes-e-correcoes.md). O
      // custo é por entidade (`Vitals.dashStaminaCost`).
      COOLDOWN: 2.5,
      // Frenagem (s): nos últimos EASE_OUT_TIME segundos, a velocidade desce
      // suave de SPEED até a de saída (0 / andar / correr, pelo input) em
      // vez de cair de uma vez no tick seguinte. Limitado a metade de
      // DURATION; 0 desliga. Ver `resolveDashSpeed` (core/actions/dash.js).
      EASE_OUT_TIME: 0.25,
    },
  },
  // Itens (docs/features/042-itens-da-beta.md).
  ITEMS: {
    // Fruta derrubada por quem foi interrompido comendo (`derrubarComida`):
    // quanto tempo (s) fica no chão antes de sumir, e a que distância (m)
    // na frente de quem comia ela cai.
    DROPPED_FOOD_LIFETIME: 6,
    DROPPED_FOOD_FORWARD_OFFSET: 0.4,
    // Física da fruta caída (`droppedFoodSystem`) — só visual, ninguém
    // pega. Sai com um impulso pra frente (TOSS_FORWARD) e pra cima
    // (TOSS_UP), espalhado pros lados em até ±TOSS_SPREAD (m/s); cai com a
    // gravidade do jogo; quica devolvendo RESTITUTION da velocidade
    // vertical; no chão, o atrito tira FRICTION (fração por segundo) da
    // velocidade horizontal; abaixo de REST_SPEED (m/s) ela para.
    DROPPED_FOOD_PHYSICS: {
      TOSS_FORWARD: 1.2,
      TOSS_UP: 2.2,
      TOSS_SPREAD: 0.8,
      RESTITUTION: 0.35,
      FRICTION: 3,
      REST_SPEED: 0.15,
      // Batida no chão acima desta velocidade (m/s) quica e conta como
      // "quicou" (`DroppedFood.landings`, pro respingo da view); abaixo,
      // ela só assenta.
      LANDING_MIN_SPEED: 1,
    },
  },
  // Grade do inventário (docs/features/041-inventario-de-itens-e-pokemon.md).
  INVENTORY: {
    // Tamanho da grade (colunas × linhas) — é também o limite do inventário
    // (`resolveInventoryCapacity`): cheio, o Pokémon capturado fica numa bola
    // no chão (docs/features/043-captura.md).
    COLUMNS: 5,
    ROWS: 5,
  },
  // A Pokébola do invocar/recolher (docs/features/043-captura.md): depois de
  // pousar, a bola fica em cima de onde a criatura nasce, ABOVE_HEAD (m)
  // acima da cabeça dela, dá um pulinho de HOP_HEIGHT (m) em HOP_TIME (s),
  // abre e fecha em OPEN_DURATION (s — o clipe `summon` encaixa aqui) e
  // some encolhendo em VANISH_DURATION (s).
  SUMMON_BALL: {
    // Quanto dura (s) o feixe da bola até a criatura ao invocar.
    BEAM_DURATION: 0.45,
    ABOVE_HEAD: 0.15,
    HOP_HEIGHT: 0.2,
    HOP_TIME: 0.2,
    OPEN_DURATION: 0.8,
    VANISH_DURATION: 0.2,
  },
  // Captura (docs/features/043-captura.md): arremesso da Pokébola em arco,
  // chance, balançadas e o que acontece depois.
  CAPTURE: {
    // Velocidade (m/s) com que a bola sai da mão. O ângulo é resolvido pro
    // arco passar pelo ponto de mira (`resolveArcLaunch`); fora do alcance,
    // sai no ângulo de alcance máximo.
    THROW_SPEED: 16,
    // Gravidade da bola em voo (m/s², negativa) — própria, pra afinar o
    // arco sem mexer na do resto do jogo.
    GRAVITY: -18,
    // Tempo máximo (s) da bola em voo antes de ser dada como perdida.
    MAX_FLIGHT_TIME: 4,
    // Raio (m) da bola: o acerto num selvagem soma isto ao raio da cápsula.
    BALL_RADIUS: 0.12,
    // A bola para no ar e o selvagem vira luz e entra (s).
    ABSORB_DURATION: 0.8,
    // Logo depois do acerto, a bola dá um pulinho: sobe ABSORB_HOP_HEIGHT (m)
    // em ABSORB_HOP_TIME (s), desacelerando, e flutua ali até cair.
    ABSORB_HOP_HEIGHT: 0.3,
    ABSORB_HOP_TIME: 0.25,
    // Depois de absorver, a bola cai até o chão — com esta gravidade (m/s²).
    FALL_GRAVITY: -12,
    // Balançadas: quantas, o intervalo (s) entre uma e outra (a primeira
    // espera o intervalo depois de pousar) e a pausa (s) depois da última
    // antes do resultado.
    SHAKE_COUNT: 3,
    SHAKE_INTERVAL: 1,
    RESULT_DELAY: 0.6,
    // Quanto tempo (s) a bola fica na tela depois do "Capturado!" e do
    // escape, pros efeitos da view.
    CAUGHT_LINGER: 1.2,
    // Bola que errou: rola com a física da comida caída
    // (`ITEMS.DROPPED_FOOD_PHYSICS`, mesmas chaves) e quebra depois de
    // MISS_LIFETIME (s).
    MISS_LIFETIME: 1.6,
    MISS_PHYSICS: {
      RESTITUTION: 0.45,
      FRICTION: 2.5,
      REST_SPEED: 0.15,
      LANDING_MIN_SPEED: 1,
    },
    // Mira (segurar o botão direito com a Pokébola na mão; o clique só
    // arremessa mirando):
    // - MODE: 'arc' mostra a linha do arco e o círculo onde a bola cai;
    //   'reticle' (como no Legends Arceus) só o retículo, que muda quando
    //   pega um selvagem e fica apagado fora do alcance.
    // - CAMERA_DISTANCE: a câmera chega até esta distância (m) mirando (se
    //   já estiver mais perto, fica); SHOULDER_OFFSET: o desvio de ombro
    //   mirando; BLEND_SPEED: rapidez da transição da câmera.
    // - RANGE: até onde (m) o raio do retículo procura o ponto de mira.
    // - TRACE_STEP: passo (s) da previsão do voo.
    // - ARC_POINTS: pontos da linha do arco; RING_RADIUS: raio (m) do
    //   círculo no chão (no selvagem, o do corpo dele).
    AIM: {
      MODE: 'reticle',
      CAMERA_DISTANCE: 3.2,
      SHOULDER_OFFSET: 0.75,
      BLEND_SPEED: 10,
      RANGE: 30,
      TRACE_STEP: 1 / 30,
      ARC_POINTS: 40,
      RING_RADIUS: 0.25,
    },
    // Taxa de captura (0-255, escala da série) de uma espécie sem
    // `capture.rate`.
    DEFAULT_RATE: 45,
    // Teto do valor `a` da fórmula (Gen 3): daí pra cima captura direto.
    MAX_CAPTURE_VALUE: 255,
    // Bônus de condição na fórmula (multiplica `a`), por condição; sem
    // condição, × 1. Hoje só existe a queimadura.
    CONDITION_BONUS: {
      burn: 1.5,
    },
    // Pelas costas (Legends Arceus): acertar um selvagem que não percebeu o
    // treinador (vagando) vindo de trás multiplica `a` por BACK_STRIKE_BONUS.
    // "De trás" = o ângulo entre a frente dele e a direção de onde a bola
    // veio passa de BACK_STRIKE_ANGLE (graus).
    BACK_STRIKE_BONUS: 2,
    BACK_STRIKE_ANGLE: 110,
    // Fração do XP de derrotar que a captura dá (só pra quem lutou).
    XP_FRACTION: 0.5,
    // Desmaiado que escapa acorda com esta fração (0-1) da vida máxima.
    ESCAPE_WAKE_HP_FRACTION: 0.3,
    // Chance (0-1) de partir pra briga ao escapar, por temperamento; senão
    // foge.
    ESCAPE_FIGHT_CHANCE: {
      hostile: 0.8,
      peaceful: 0.25,
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
    // entre o degrau por célula das rampas do nível e o salto de um terraço
    // sem rampa — senão ou bloqueia rampas de verdade, ou deixa passar de um
    // andar pro outro sem rampa nenhuma.
    MAX_CLIMB_STEP: 0.6,
    // Distância máxima (m) de um único salto suavizado do caminho
    // (`boundedSmoothPath` em core/pathfinding.js) — mesmo que um trecho
    // reto inteiro seja andável célula a célula, virar UM waypoint só bem
    // longe (a trilha de teste inteira, por exemplo, cabe numa lane
    // estreita) dá tempo demais pra criatura desviar da lane antes
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
    // Perseguindo, a selvagem para quando o alvo estiver a esta fração do
    // alcance do golpe (range + radius + raio do corpo do alvo) — perto o
    // bastante pra acertar com folga.
    ATTACK_REACH_FRACTION: 0.8,
    // Sem golpe nenhum, para quando sobrar este vão (m) entre os corpos
    // (bordas das cápsulas).
    CHASE_STOP_GAP: 0.8,
    // Segundos entre um pedido de golpe e o próximo, perseguindo.
    ATTACK_INTERVAL: 1.2,
    // Pacífica que apanha: chance (0-1) BASE de revidar; senão, foge. A
    // chance de verdade é a "coragem" pela situação (`resolveRetaliateChance`):
    // sobe com a vida dela (peso × quanto passa de metade), cai com o tamanho
    // do golpe (peso × dano em fração da vida máxima), sobe se ela está
    // melhor que o agressor (peso × diferença das vidas) — limitada entre
    // MIN e MAX (sempre sobra surpresa).
    RETALIATE_CHANCE: 0.5,
    COURAGE_HP_WEIGHT: 0.6,
    COURAGE_HIT_WEIGHT: 1,
    COURAGE_ADVANTAGE_WEIGHT: 0.4,
    COURAGE_MIN_CHANCE: 0.05,
    COURAGE_MAX_CHANCE: 0.95,
    // Fuga com HP baixo: perseguindo (hostil ou pacífica revidando), ao
    // chegar nesta fração da vida sorteia UMA vez se foge...
    LOW_HP_FLEE_FRACTION: 0.25,
    LOW_HP_FLEE_CHANCE: 0.5,
    // ...e fugindo assim não persegue ninguém (nem hostil no raio, nem
    // apanhando) até a vida voltar a esta fração.
    LOW_HP_RECOVER_FRACTION: 0.5,
    // Ameaça cai pela metade a cada este tanto (s); entrada abaixo de
    // THREAT_MIN sai da tabela.
    THREAT_HALF_LIFE: 10,
    THREAT_MIN: 0.5,
    // Quem persegue porque APANHOU (pacífica revidando, ou hostil atacada
    // de longe) só desiste além desta distância (m).
    RETALIATE_LEASH_RADIUS: 14,
    // Fugindo: corre pra um ponto a este tanto (m) dela — escolhido entre
    // FLEE_DIRECTIONS direções em volta, o ANDÁVEL que deixa ela mais longe
    // de quem persegue (bônus de FLEE_CLEAR_LINE_BONUS m se o caminho reto
    // está livre) — `resolveFleeDestination`, core/battle/flee.js. Guardado e
    // refeito a cada FLEE_REPICK_INTERVAL (s), ao chegar (FLEE_ARRIVE_DISTANCE,
    // m) ou travando...
    FLEE_STEP: 6,
    FLEE_DIRECTIONS: 16,
    FLEE_CLEAR_LINE_BONUS: 2,
    FLEE_REPICK_INTERVAL: 0.75,
    FLEE_ARRIVE_DISTANCE: 1,
    // ...até ficar a esta distância (m); aí volta a vagar dali.
    FLEE_SAFE_DISTANCE: 14,
  },
  // IA das criaturas do time fora do controle do jogador — sempre
  // defensiva (`partyBehaviorSystem.js`, `PartyBehavior`): entra na luta
  // contra a selvagem que acertou alguém do grupo.
  PARTY_BEHAVIOR: {
    // Segundos entre um pedido de golpe e o próximo. Mais lento que o
    // jogador de propósito: a IA ajuda, quem decide a luta é quem joga.
    ATTACK_INTERVAL: 1.5,
    // Para quando o alvo estiver a esta fração do alcance do golpe (mesma
    // regra das selvagens, `WILD_BEHAVIOR`).
    ATTACK_REACH_FRACTION: 0.8,
    // Se afastou mais que isto (m, no plano) de quem segue (quem está no
    // controle), larga a luta e volta a seguir.
    LEASH_RADIUS: 15,
  },
  // Treinador numa luta, fora do controle (`trainerBattleSystem.js`): fica
  // longe, desvia, foge pro time se mirado. A selvagem só mira nele se ele
  // for o único do lado do jogador no raio de perseguição dela
  // (`excludeCoveredTrainer`, core/battle/combatTargets.js).
  TRAINER_BATTLE: {
    // Zona segura (com folga): a pelo menos SAFE_MIN_DISTANCE (m) de toda
    // selvagem na luta e no máximo SAFE_MAX_DISTANCE (m) da criatura
    // controlada — dentro dela, fica parado encarando a luta.
    SAFE_MIN_DISTANCE: 5,
    SAFE_MAX_DISTANCE: 12,
    // Fora da zona: vai pra um ponto a esta distância (m) atrás da criatura
    // controlada, do lado oposto à selvagem mais perto dela — escolhido UMA
    // vez e guardado até chegar (ou ficar fora da zona).
    SAFE_DISTANCE: 7,
    // Chegou na posição segura com esta folga (m): para e encara a luta.
    ARRIVE_DISTANCE: 1,
    // Corre (em vez de andar) se alguma selvagem estiver a esta distância
    // (m) dele.
    DANGER_DISTANCE: 4,
    // Mirado por uma selvagem: corre até ficar a esta distância (m) da
    // criatura do time mais perto.
    TEAM_STOP_DISTANCE: 2,
  },
  // Escolha do ALVO pela IA (os dois lados — `core/battle/combatTargets.js`):
  // alvo quase desmaiando ganha prioridade, pra terminar a luta.
  AI_TARGET: {
    // Vida (fração) em que o alvo passa a ter prioridade...
    FINISH_HP_FRACTION: 0.25,
    // ...e quanto: multiplica a ameaça dele (e divide a distância) na
    // selvagem. A criatura do time, ao trocar de alvo, pega a de menos vida.
    FINISH_BONUS: 2,
  },
  // Custo de energia e recarga das ações das CRIATURAS, por fórmula
  // (`core/battle/actionCost.js`, docs/features/035-balanceamento-
  // de-acoes-e-correcoes.md) — adaptada da fórmula de dano. `staminaCost`/`cooldown`
  // escritos na skill (ou no override da espécie) valem por cima.
  ACTION_COST: {
    // custo = (2·nível/5 + 2) × peso / COST_DIVISOR — o fator de nível do
    // dano. Maior = tudo mais barato (mais habilidades por barra).
    COST_DIVISOR: 50,
    // recarga = peso × COOLDOWN_PER_WEIGHT (s) × fator de velocidade.
    COOLDOWN_PER_WEIGHT: 0.085,
    // Peso × RANGED_BONUS quando o golpe alcança RANGED_MIN_RANGE (m) ou
    // mais — bater de longe é mais seguro...
    RANGED_MIN_RANGE: 5,
    RANGED_BONUS: 1.25,
    // ...e × CONE_BONUS em cone (pode pegar mais de um inimigo).
    CONE_BONUS: 1.3,
    // Peso do movimento das criaturas, na mesma conta (`resolveLevelCost`):
    // corrida POR SEGUNDO, dash e pulo.
    RUN_WEIGHT_PER_SECOND: 4,
    DASH_WEIGHT: 15,
    JUMP_WEIGHT: 5,
  },
  // Escolha do golpe pela IA (selvagens e time fora do controle —
  // `core/battle/aiAttackChoice.js`): cada golpe pronto ganha uma nota pelos
  // campos da definição (poder, área, efeitos), nunca pelo id da skill.
  AI_ATTACK: {
    // Golpe que já alcança o alvo agora vale este tanto a mais (prefere
    // lançar já a correr até o alcance de outro).
    IN_REACH_BONUS: 1.25,
    // Sorteio entre os golpes com nota de pelo menos esta fração da melhor,
    // com chance proporcional à nota — não fica previsível.
    NEAR_BEST_FRACTION: 0.6,
    // Valor de UM estágio de status (baixar o do inimigo, subir o próprio),
    // na mesma escala do `damage.power`.
    STAT_STAGE_VALUE: 25,
    // Cada estágio já acumulado no sentido do efeito multiplica o valor por
    // isto: acumula, mas bater passa a valer mais.
    STAT_STAGE_DECAY: 2 / 3,
    // Valor de plantar uma semente (efeito `leechSeed`).
    LEECH_SEED_VALUE: 35,
    // Valor de queimar o alvo (efeito `burn`), já com a certeza — o golpe
    // multiplica pela `chance` do efeito.
    BURN_VALUE: 40,
    // Efeito ativo com até estes segundos sobrando volta a valer cheio
    // (renovar antes de acabar).
    EFFECT_REFRESH_TIME: 3,
    // Golpe em si mesmo (`area: 'self'`, ex.: Growth) só com nenhum inimigo
    // a esta distância (m) — a carga é interrompida por dano.
    SELF_CAST_SAFE_DISTANCE: 4,
  },
  // Energia da IA na luta (`core/battle/aiEnergy.js`) — todo gasto reinicia o
  // atraso da regeneração, então gastar sempre um pouco nunca deixa regenerar.
  AI_ENERGY: {
    // Habilidade (golpe mais caro que o mais barato pronto) só se sobrar
    // esta fração (0-1) da energia máxima depois de pagar.
    SKILL_RESERVE_FRACTION: 0.25,
    // Com a energia nesta fração ou menos, descansa: sem golpe e sem correr...
    REST_ENTER_FRACTION: 0.15,
    // ...até voltar a esta fração.
    REST_EXIT_FRACTION: 0.6,
  },
  // Movimento da IA na luta (`core/battle/aiMovement.js`): desvio, recuo,
  // rodear o alvo, dash e o feixe seguindo o alvo.
  AI_MOVEMENT: {
    // Chance (0-1) de reagir a um golpe vindo nela — sorteada UMA vez por
    // golpe.
    DODGE_CHANCE: 0.5,
    // Só reage depois de o golpe estar carregando há isto (s) — golpe rápido
    // demais pega.
    DODGE_REACTION_TIME: 0.2,
    // Golpe planejado à distância (`aim: 'ranged'`): recua se o alvo estiver
    // mais perto que esta fração do alcance dele...
    KEEP_DISTANCE_MIN: 0.5,
    // ...andando pra um ponto este tanto (m) pra trás (recalculado sempre).
    RETREAT_STEP: 3,
    // Rodeando o alvo: velocidade como fração do `walkSpeed` (andando — não
    // gasta energia)...
    STRAFE_SPEED_FACTOR: 0.6,
    // ...a esta fração da distância de parada (dentro do alcance)...
    STRAFE_DISTANCE_FRACTION: 0.9,
    // ...trocando de sentido a cada intervalo sorteado entre estes (s).
    STRAFE_SWITCH_MIN: 1.5,
    STRAFE_SWITCH_MAX: 3.5,
    // Rodeando, ela anda virada pra onde vai; com o golpe pronto, para e vira
    // pro alvo, e só pede o golpe com o corpo a até este ângulo (rad)
    // dele — o disparo trava o corpo de uma vez, vindo de lado seria um estalo.
    AIM_TOLERANCE: 0.35,
    // (O dash da IA usa `PLAYER_ACTIONS.dash` — mesma velocidade, duração e
    // recarga do jogador, `DashCooldown`; custo da entidade, 035.)
    // Aproximando: dá dash se ainda faltar mais que isto (m) até o alcance.
    DASH_CLOSE_DISTANCE: 5,
    // Feixe da IA (canal em `area: 'line'`): quanto (rad/s) ele gira no
    // máximo pra seguir o alvo — dá pra escapar correndo de lado.
    BEAM_TURN_SPEED: 1.5,
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

  // Experiência e nível (docs/features/037-experiencia-e-nivel.md):
  // `core/data/species/experience.js` e `core/actions/experience.js`.
  EXPERIENCE: {
    // Teto de nível — a curva para aqui e o XP não passa do total dele.
    MAX_LEVEL: 50,
    // Multiplica o XP total de todo degrau de todas as curvas de nível — o
    // "preço" dos níveis, valendo pra qualquer fonte de XP (batalha, item).
    // Pra mudar o ritmo de tudo, mexe aqui; o ganho de batalha é ajustado
    // por `BASE_DIVISOR`.
    CURVE_MULTIPLIER: 10,
    // Fórmula escalada (Gen 5): `(baseXp × Nd ÷ BASE_DIVISOR) ×
    // ((2·Nd + 10) ÷ (Nd + Nv + 10))^SCALING_EXPONENT + 1`.
    BASE_DIVISOR: 5,
    SCALING_EXPONENT: 2.5,
    // XP base de uma espécie sem `baseXp` configurado.
    FALLBACK_BASE_XP: 50,
    // Grupo de crescimento de uma espécie sem `growthRate`.
    DEFAULT_GROWTH_RATE: 'medium-slow',
    // Faixa de nível sorteada pra selvagem cuja entrada de spawn não traz
    // a própria (`levelRange`).
    WILD_LEVEL_MIN: 3,
    WILD_LEVEL_MAX: 8,
    // XP dado pelo botão "+XP" do `DebugPanel`.
    DEBUG_XP_AMOUNT: 100,
  },

  // Golpes aprendidos, treino e domínio
  // (docs/features/038-aprendizado-treino-e-dominio-de-golpes.md).
  MOVES: {
    MASTERY: {
      // Domínio com que um golpe recém-aprendido entra no slot (0–1).
      INITIAL: 0.15,
      // Fator de precisão/chance de sair no domínio zero; sobe em linha
      // até 1 (precisão clássica) no domínio máximo.
      MIN_ACCURACY_FACTOR: 0.5,
      // Multiplicadores de energia e de recarga no domínio zero; descem em
      // linha até 1 no domínio máximo.
      MAX_COST_FACTOR: 1.6,
      MAX_COOLDOWN_FACTOR: 1.6,
      // Domínio ganho por uso em combate (errando); acertar soma o bônus.
      GAIN_PER_USE: 0.03,
      HIT_GAIN_BONUS: 0.02,
      // Retorno decrescente: o ganho é multiplicado pelo que falta até o
      // máximo, mas nunca por menos que esta fração (pra chegar no teto).
      MIN_GAIN_FRACTION: 0.25,
      // Raio em que uma selvagem em combate faz o uso do golpe contar como
      // "em combate" (usar no vazio não sobe domínio).
      OPPONENT_RADIUS: 15,
    },
    TRAINING: {
      // Distância máxima entre a criatura e um objeto de treino pra poder
      // começar (e continuar) o treino.
      START_RADIUS: 6,
      // TEMPO de treino (horas) pra APRENDER um golpe: proporcional ao peso
      // do golpe (o mesmo da conta de energia, `resolveAttackWeight`) —
      // LEARN_HOURS_PER_100_WEIGHT é o tempo de um golpe de peso 100; nunca
      // menos que MIN_LEARN_HOURS. Golpe com `trainingHours` escrito foge da
      // fórmula. Conta só o tempo treinando no objeto (repetindo, esperando
      // recarga ou descansando), não o de ir até ele.
      LEARN_HOURS_PER_100_WEIGHT: 20,
      MIN_LEARN_HOURS: 1,
      // Tempo de treino pra DOMINAR (de zero ao máximo de domínio), em
      // múltiplos do tempo de aprender o mesmo golpe.
      MASTERY_HOURS_MULTIPLIER: 10,
      // Acelera o relógio do treino (testes em jogo); 1 = tempo real.
      TIME_MULTIPLIER: 1,
      // Pausa entre uma repetição e a próxima (segundos).
      REPETITION_INTERVAL: 0.6,
      // Sem energia pra repetir, descansa até recuperar esta fração da
      // energia máxima.
      REST_STAMINA_FRACTION: 0.6,
      // Fração do treino que sobra de um golpe esquecido (re-treinar é mais
      // rápido).
      FORGET_RETAINED: 0.5,
      // Progresso dado pelo botão de debug.
      DEBUG_PROGRESS: 0.5,
    },
    // Segurar Q/E/R no modo treinador por este tempo (segundos) abre o menu
    // de ações daquele Pokémon; soltar antes é um toque (invoca/recolhe).
    ACTION_MENU_HOLD_TIME: 0.5,
    // Domínio dado pelo botão de debug.
    DEBUG_MASTERY: 0.2,
  },

  ANIMATION: {
    // Abaixo disso, considera parado (idle).
    WALK_MIN_SPEED: 0.3,
    // Acima disso, considera correndo (run) em vez de andando (walk). Fica
    // entre walkSpeed e runSpeed de MovementStats (core/data/species).
    RUN_MIN_SPEED: 4,
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
    // (MAX_PITCH perto de π/2 = quase de cima); `pitch` 0 é olhar reto,
    // no nível do alvo. Pra olhar pra CIMA (céu, algo alto à frente), a
    // câmera precisa descer ABAIXO do alvo e inclinar — isso é `pitch`
    // NEGATIVO, não perto de zero (um MIN_PITCH só um pouco acima de 0
    // nunca deixa passar do "olhar reto", por menor que seja — foi o que
    // limitava antes).
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
  RENDER: {
    // Visual toon (estilo Zelda) — ver src/view/materials/toonMaterial.js
    TOON: true, // false = visual antigo (MeshStandardMaterial do .glb)
    TOON_RAMP: [120, 200, 255], // tons chapados da luz: sombra, meio-tom, luz (0–255)
    OUTLINE_WIDTH: 0.0045, // espessura do contorno, em unidades do modelo (antes do scale)
    OUTLINE_COLOR: '#3a1410',
    OUTLINE_SKIP: ['fire'], // materiais (por nome) que não ganham contorno
    RIM_STRENGTH: 0.22, // brilho de borda; 0 desliga
    // faixa do rim (0 = de frente pra câmera, 1 = de lado): começa a acender
    // no primeiro valor e chega no máximo no segundo — perto um do outro =
    // corte seco, estilo toon
    RIM_EDGE: [0.62, 0.68],
    RIM_COLOR: '#ffe6b3',
  },
}
