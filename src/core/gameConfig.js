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
    // Deslocamento da câmera em relação ao alvo, em unidades de mundo.
    OFFSET: { x: 0, y: 6, z: 10 },
    // Fator de suavização do acompanhamento (maior = mais rígido).
    SMOOTHING: 5,
  },
}
