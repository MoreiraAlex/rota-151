import { GAME_CONFIG } from '@/core/gameConfig'
import { Position, OrbitCamera, CameraTarget } from '@/core/traits'

/**
 * Posiciona a câmera Three a partir da órbita (OrbitCamera) em torno da
 * entidade CameraTarget, com suavização. Vive na view porque dirige a câmera.
 *
 * Fase: presentation (passo variável), depois do syncTransformSystem.
 * A câmera chega em context.camera (câmera default do R3F, via useThree).
 */
export function cameraFollowSystem(context) {
  const { world, delta, camera } = context
  if (!camera) return

  const target = world.queryFirst(CameraTarget, Position)
  const rig = world.queryFirst(OrbitCamera)
  if (!target || !rig) return

  const pos = target.get(Position)
  const orbit = rig.get(OrbitCamera)
  const { SMOOTHING, TARGET_HEIGHT } = GAME_CONFIG.CAMERA

  const cosPitch = Math.cos(orbit.pitch)
  const offsetX = Math.sin(orbit.yaw) * cosPitch * orbit.distance
  const offsetY = Math.sin(orbit.pitch) * orbit.distance
  const offsetZ = Math.cos(orbit.yaw) * cosPitch * orbit.distance

  const lookX = pos.x
  const lookY = pos.y + TARGET_HEIGHT
  const lookZ = pos.z

  const t = Math.min(1, SMOOTHING * delta)
  camera.position.x += (lookX + offsetX - camera.position.x) * t
  camera.position.y += (lookY + offsetY - camera.position.y) * t
  camera.position.z += (lookZ + offsetZ - camera.position.z) * t

  camera.lookAt(lookX, lookY, lookZ)
}
