import { GAME_CONFIG } from '@/core/gameConfig'
import { Position, InputControlled } from '@/core/traits'

/**
 * Câmera em terceira pessoa: acompanha a entidade controlada mantendo um
 * deslocamento fixo, com suavização. Vive na view porque dirige a câmera Three.
 *
 * Fase: presentation (passo variável), depois do syncTransformSystem.
 * A câmera chega em context.camera (câmera default do R3F, via useThree).
 */
export function cameraFollowSystem(context) {
  const { world, delta, camera } = context
  if (!camera) return

  const target = world.queryFirst(InputControlled, Position)
  if (!target) return

  const pos = target.get(Position)
  const { OFFSET, SMOOTHING } = GAME_CONFIG.CAMERA
  const t = Math.min(1, SMOOTHING * delta)

  camera.position.x += (pos.x + OFFSET.x - camera.position.x) * t
  camera.position.y += (pos.y + OFFSET.y - camera.position.y) * t
  camera.position.z += (pos.z + OFFSET.z - camera.position.z) * t

  camera.lookAt(pos.x, pos.y, pos.z)
}
