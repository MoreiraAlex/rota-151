import IDLE_CLIP from './clips/idle.json'
import WALK_CLIP from './clips/walk.json'
import RUN_CLIP from './clips/run.json'

/**
 * Fox (Khronos Sample Assets) — modelo temporário do jogador, não é uma
 * criatura do jogo. Fica no registro de espécies porque o jogador é tratado
 * como mais uma entrada dele (mesmo esquema de model/clips/stats que uma
 * criatura real terá). Sem prefixo numérico de dex — não é um Pokémon.
 *
 * Troque `id`/pasta quando o modelo definitivo do treinador estiver pronto;
 * quem referencia isso é só `PlayerView.jsx`.
 */
export const FOX = {
  id: 'fox',
  dexNumber: null,
  model: {
    path: '/assets/models/fox-debug.glb',
    scale: 0.015,
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
    modelOffset: [0, -0.5, 0],
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
  stats: {},
  moves: [],
}
