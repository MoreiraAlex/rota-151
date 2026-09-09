import { trait } from 'koota'

/**
 * Velocidade desejada, em unidades por segundo.
 *
 * Dono de escrita: movementSystem.
 * Leem: movementSystem (integração em Position). Futuramente: física.
 */
export const Velocity = trait({
  x: 0,
  y: 0,
  z: 0,
})
