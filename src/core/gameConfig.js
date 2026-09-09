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
  PLAYER: {
    // Unidades por segundo (1 unidade = 1 metro).
    MOVE_SPEED: 5,
    // Fator de suavização do giro em direção ao movimento (rad/s aprox.).
    TURN_SPEED: 10,
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
