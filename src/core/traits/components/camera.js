import { trait } from 'koota'

/**
 * Órbita desejada da câmera em torno do alvo, em coordenadas esféricas.
 * - yaw: ângulo horizontal (rad)
 * - pitch: ângulo vertical/elevação (rad), limitado por GAME_CONFIG.CAMERA
 * - distance: raio da órbita (unidades)
 *
 * Dono de escrita: cameraControlSystem.
 * Leem: cameraFollowSystem (posição da câmera), movementSystem (yaw para o
 * movimento relativo).
 */
export const OrbitCamera = trait({
  yaw: 0,
  pitch: 0.35,
  distance: 12,
})

/**
 * Tag: marca a entidade que a câmera orbita e para a qual olha.
 */
export const CameraTarget = trait()
