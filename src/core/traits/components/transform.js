import { trait } from 'koota'

/**
 * Posição no mundo, em unidades (1 unidade = 1 metro). Y para cima.
 *
 * Dono de escrita: movementSystem (e, futuramente, o system de física).
 * Leem: syncTransformSystem, cameraFollowSystem.
 */
export const Position = trait({
  x: 0,
  y: 0,
  z: 0,
})

/**
 * Rotação em radianos (ordem de Euler padrão do Three.js).
 *
 * Dono de escrita: movementSystem.
 * Leem: syncTransformSystem.
 */
export const Rotation = trait({
  x: 0,
  y: 0,
  z: 0,
})
