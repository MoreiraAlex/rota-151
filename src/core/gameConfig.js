/**
 * Configuração central do jogo.
 *
 * Toda constante ajustável vive aqui, agrupada por domínio. Systems e
 * componentes leem daqui — nunca declaram números mágicos.
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
  PLAYER_ACTIONS: {
    dash: {
      // Duração do impulso (segundos).
      DURATION: 0.25,
      // Unidades por segundo — maior que o runSpeed de qualquer espécie hoje.
      SPEED: 14,
      // Custo de stamina, descontado uma vez no disparo (não por segundo).
      STAMINA_COST: 15,
    },
    throw: {
      // Duração total da ação (segundos) — precisa bater com a duração de
      // verdade do clipe de animação de arremesso (core/data/species/<id>/
      // clips/throw.json): clipes de AÇÃO (não cíclicos) usam `speed` como
      // `1/duração` (mesma leitura de "ciclos/segundo" dos clipes de
      // locomoção, mas aqui vira "a ação inteira é 1 ciclo" — ver a skill
      // procedural-rig-animation, referências/animations/one-shot-
      // actions.md). O clipe do bot tem `speed: 2.5` → 1/2.5 = 0.4s. Errar
      // esse valor (maior que o real) faz o gesto reiniciar do início e
      // ficar visivelmente "engasgado" antes de cortar pro idle — o motor
      // não trava o clipe no fim (`loop: false` no JSON é só documentação,
      // não é lido em lugar nenhum), ele só repete o mesmo gesto fechado.
      DURATION: 0.4,
      // Instante (dentro da duração) em que o projétil é de fato spawnado —
      // não é keyframe de clipe, é config da própria ação (ver
      // docs/features/014-arremessar-usar-e-invocar.md). Devia coincidir
      // com o frame em que a MÃO solta o objeto no clipe de animação — isso
      // não dá pra derivar só do `speed` (fica na forma da curva, não no
      // número), então por enquanto é a mesma fração que já estava ajustada
      // antes desta correção (0.45/0.5 = 90% da duração antiga), só
      // reescalada pra duração certa (0.4 × 90% = 0.36) — ainda precisa de
      // olho no jogo pra confirmar se bate com a soltura visual de verdade.
      EFFECT_AT: 0.3,
      // Origem do arremesso (de onde a trajetória sai e onde o projétil
      // nasce) — aproxima a posição da MÃO a partir de `Position`/
      // `Rotation.y` do jogador, já que o motor não tem acesso ao osso de
      // verdade daqui (isso é conteúdo da view — ver
      // `view/systems/heldItemViewSystem.js`, que só cuida do visual
      // encaixado no osso, não da trajetória/spawn). Componentes somados
      // na direção que o corpo encara (`HAND_FORWARD_OFFSET`, à frente) e
      // à direita dele (`HAND_SIDE_OFFSET`) — mesma convenção de
      // forward/right usada em todo o resto (`computeCameraRight`,
      // `movementSystem.js`). `HAND_HEIGHT_OFFSET` substitui o antigo "+1"
      // fixo.
      HAND_FORWARD_OFFSET: 0.15,
      HAND_SIDE_OFFSET: -0.25,
      HAND_HEIGHT_OFFSET: 1.25,
      // Velocidade do projétil (m/s). Global, não por item — só existe um
      // throwable de teste hoje; migra pra config por item quando um
      // segundo precisar de velocidade diferente.
      SPEED: 45,
      // Segundos até o projétil desaparecer sozinho, mesmo já tendo
      // atingido algo (congelado no ponto do impacto até então).
      LIFETIME: 1.5,
      // Alcance máximo (m) do raycast de mira, a partir da câmera — nada
      // encontrado dentro dessa distância, mira no ponto mais distante
      // dessa distância mesmo (em vez de mirar no infinito).
      AIM_RANGE: 30,
      // Custo de stamina, descontado uma vez no disparo (não por segundo) —
      // mesmo padrão do dash. Sem stamina suficiente, o arremesso
      // simplesmente não dispara.
      STAMINA_COST: 2,
    },
    consume: {
      // Duração total da ação (segundos).
      DURATION: 0.4,
      // Instante em que o efeito do item (cura, ver `item.consumable`) é
      // de fato aplicado.
      EFFECT_AT: 0.2,
      // Quanto tempo o efeito visual de partículas (ConsumeEffect) fica na
      // cena depois de spawnado — independente da duração da ação em si.
      EFFECT_VISUAL_DURATION: 0.6,
    },
    // Invocar/recolher criatura de time (ver `partySummonSystem.js` e
    // docs/features/017-locomocao-e-recolhimento-de-criaturas.md) — mesmo
    // padrão de ação com duração/efeito-no-meio de dash/throw/consume
    // acima, só que quem avança/aplica o efeito é `partySummonSystem.js`,
    // não este arquivo (`playerActionSystem.js` explicitamente ignora
    // `current` 'summon'/'recall', ver docstring do system).
    summon: {
      // Duração total da ação (segundos) — trava movimento e qualquer
      // outra ação (dash/arremesso/uso/outra invocação) até terminar.
      DURATION: 0.6,
      // Instante em que a `SummonedCreature` de fato nasce.
      EFFECT_AT: 0.3,
    },
    recall: {
      // Duração total da ação (segundos).
      DURATION: 0.6,
      // Instante em que a `SummonedCreature` de fato é destruída.
      EFFECT_AT: 0.3,
    },
  },
  PARTY: {
    // Distância inicial (m) da criatura ao nascer (no instante de efeito
    // da ação de invocar), na direção que a CÂMERA está apontando (não
    // `Rotation.y` do treinador — ele gira pra encarar essa mesma direção
    // no disparo, ver `partySummonSystem.js`).
    SUMMON_OFFSET: 15,
    // Distância mínima (m) que a criatura mantém do treinador — não chega
    // mais perto que isso, pra não empilhar em cima dele.
    FOLLOW_MIN_DISTANCE: 4,
    // Distância (m) além da qual a criatura corre (`runSpeed`, por
    // espécie) em vez de andar (`walkSpeed`) pra alcançar o treinador —
    // ver creatureFollowSystem. Entre `FOLLOW_MIN_DISTANCE` e este valor,
    // anda; abaixo de `FOLLOW_MIN_DISTANCE`, parada.
    RUN_DISTANCE: 6,
    // Distância (m) abaixo da qual outro personagem (treinador ou outra
    // criatura) conta como "muito perto" — soma repulsão na direção de
    // movimento pra desviar ANTES de esbarrar de verdade (personagens
    // colidem fisicamente de propósito, ver core/physics/colliders.js —
    // isso aqui evita precisar chegar nesse ponto). Maior que a soma dos
    // raios de duas cápsulas típicas.
    AVOIDANCE_RADIUS: 2.5,
    // Peso da repulsão de `AVOIDANCE_RADIUS` em relação à direção
    // principal (waypoint/treinador, sempre vetor unitário) — cada vizinho
    // próximo soma até este tanto na direção final antes de normalizar.
    AVOIDANCE_STRENGTH: 1.2,
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
  VITALS: {
    // Segundos sem regenerar HP depois de tomar dano — não é atributo de
    // criatura, é comportamento do motor (custo de ação também é aqui, ver
    // decisão em 010-hp-e-stamina.md). Regeneração em si (%/segundo) é que
    // vem da espécie (core/data/species/<id>/index.js).
    HP_REGEN_DELAY_AFTER_DAMAGE: 5,
    // Segundos sem regenerar stamina depois do último uso (correr, dash ou
    // pulo) — reseta a cada dreno, igual ao delay de HP reseta a cada dano.
    STAMINA_REGEN_DELAY_AFTER_USE: 3,
    // Stamina gasta por segundo enquanto realmente correndo.
    RUN_STAMINA_DRAIN_PER_SECOND: 2,
    // Custo de stamina do pulo, descontado uma vez no disparo.
    JUMP_STAMINA_COST: 10,
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
    GRAVITY: -45,
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
    MIN_DISTANCE: 5,
    MAX_DISTANCE: 25,
    // Radianos por pixel de movimento do mouse (pointer lock).
    MOUSE_SENSITIVITY: 0.0025,
    // Unidades de distância por "notch" de scroll.
    ZOOM_SPEED: 1.5,
    // Fator de suavização do acompanhamento (maior = mais rígido).
    SMOOTHING: 12,
    // Fator de suavização da transição do ENQUADRAMENTO de mira (o
    // `aimBlend` que interpola entre olhar pro jogador e olhar pro
    // `AimAnchor` travado, em `cameraFollowSystem.js`) — mesmo formato de
    // `SMOOTHING`, mas com seu próprio ritmo, pra poder ajustar a
    // suavidade da mira independente da suavidade do acompanhamento geral.
    AIM_BLEND_SMOOTHING: 15,
    // Altura do ponto de mira acima da origem do alvo.
    TARGET_HEIGHT: 1.5,
    // Deslocamento lateral (m) do ponto que a câmera mira, em relação ao
    // alvo — usado tanto na resolução do ponto de mira (`computeAimRay`, o
    // raio que decide onde travar o `AimAnchor` ao começar a mirar) quanto
    // no enquadramento renderizado de fato (`cameraFollowSystem.js`, que
    // aplica o desvio completo enquanto travado — ver docstring lá): o
    // retículo (fixo no centro da tela) não se move, mas o personagem sai
    // do centro, dando o enquadramento "sobre o ombro" de verdade. 0
    // desativa o efeito por completo (personagem sempre centralizado).
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
  },
}
