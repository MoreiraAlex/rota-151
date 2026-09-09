import { GAME_CONFIG } from '../gameConfig'
import { OrbitCamera } from '../traits'

const TWO_PI = Math.PI * 2

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

/**
 * Atualiza a órbita da câmera (trait OrbitCamera) a partir do movimento do
 * mouse e do scroll (context.input, preenchido pelo pointerInput).
 *
 * - cameraYaw / cameraPitch: deltas de mouse já acumulados pelo adapter,
 *   convertidos por MOUSE_SENSITIVITY. Mouse para a direita gira a visão para a
 *   direita (yaw diminui); mouse para baixo olha para baixo (pitch aumenta).
 * - zoom: passos de scroll, escalados por ZOOM_SPEED.
 *
 * O yaw é livre (só normalizado); o pitch é limitado por MIN_PITCH / MAX_PITCH.
 *
 * Headless. Fase: simulation, antes do movementSystem (que lê o yaw resultante).
 */
export function cameraControlSystem(context) {
  const { world } = context
  const input = context.input ?? {}
  const c = GAME_CONFIG.CAMERA

  const yawDelta = -(input.cameraYaw ?? 0) * c.MOUSE_SENSITIVITY
  const pitchDelta = (input.cameraPitch ?? 0) * c.MOUSE_SENSITIVITY
  const zoomDelta = (input.zoom ?? 0) * c.ZOOM_SPEED

  world.query(OrbitCamera).updateEach(([orbit]) => {
    orbit.yaw = (orbit.yaw + yawDelta) % TWO_PI
    orbit.pitch = clamp(orbit.pitch + pitchDelta, c.MIN_PITCH, c.MAX_PITCH)
    orbit.distance = clamp(
      orbit.distance + zoomDelta,
      c.MIN_DISTANCE,
      c.MAX_DISTANCE,
    )
  })
}
