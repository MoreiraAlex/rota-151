import { trait } from 'koota'

/**
 * Intenção de movimento derivada do input, como vetor no plano do mundo.
 * Cada eixo fica em [-1, 1]; o conjunto é normalizado quando excede 1.
 *
 * Dono de escrita: inputSystem.
 * Leem: movementSystem.
 */
export const InputState = trait({
  x: 0,
  z: 0,
})

/**
 * Tag: marca a entidade como controlada pelo input local do jogador.
 */
export const InputControlled = trait()
