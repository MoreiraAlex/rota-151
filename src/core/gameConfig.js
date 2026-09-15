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
      // Duração total da ação (segundos).
      DURATION: 0.6,
      // Instante (dentro da duração) em que o projétil é de fato spawnado —
      // não é keyframe de clipe, é config da própria ação (ver
      // docs/features/014-arremessar-usar-e-invocar.md).
      EFFECT_AT: 0.4,
      // Velocidade do projétil (m/s). Global, não por item — só existe um
      // throwable de teste hoje; migra pra config por item quando um
      // segundo precisar de velocidade diferente.
      SPEED: 14,
      // Segundos até o projétil desaparecer sozinho (sem colisão ainda).
      LIFETIME: 3,
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
  },
  PARTY: {
    // Distância inicial (m) da criatura ao ser invocada, à frente do
    // treinador na direção que ele olha.
    SUMMON_OFFSET: 2,
    // Velocidade (m/s) com que a criatura invocada se aproxima do
    // treinador — ver creatureFollowSystem.
    FOLLOW_SPEED: 6,
    // Distância mínima (m) que a criatura mantém do treinador — não chega
    // mais perto que isso, pra não empilhar em cima dele.
    FOLLOW_MIN_DISTANCE: 2,
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
    },
  },
  CAMERA: {
    // Órbita inicial em torno do alvo.
    INITIAL_YAW: 0,
    INITIAL_PITCH: 0.35,
    INITIAL_DISTANCE: 12,
    // Limite do ângulo vertical (pitch), em radianos. O horizontal (yaw) é
    // livre. ~0.15 rad ≈ 9° (quase rente ao chão); ~1.35 rad ≈ 77° (quase de
    // cima). Ajuste à vontade.
    MIN_PITCH: 0.05,
    MAX_PITCH: 0.75,
    // Limites do zoom, em unidades.
    MIN_DISTANCE: 5,
    MAX_DISTANCE: 25,
    // Radianos por pixel de movimento do mouse (pointer lock).
    MOUSE_SENSITIVITY: 0.0025,
    // Unidades de distância por "notch" de scroll.
    ZOOM_SPEED: 1.5,
    // Fator de suavização do acompanhamento (maior = mais rígido).
    SMOOTHING: 12,
    // Altura do ponto de mira acima da origem do alvo.
    TARGET_HEIGHT: 1.0,
  },
}
