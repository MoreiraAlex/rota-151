import { GAME_CONFIG } from '../gameConfig'
import { clamp, wrapAngle } from '../math'
import { Indoors, OrbitCamera, Party } from '../traits'
import { INTERIOR_FRONT_YAW } from '../interior/interiorPlacement'

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

  // Dentro de um prédio (docs/features/068-interior-dos-predios.md), a
  // câmera fica de frente para a sala, só com a folga de `INTERIOR.CAMERA`.
  const indoors = world.queryFirst(Party)?.has(Indoors)
  const room = GAME_CONFIG.INTERIOR.CAMERA

  world.query(OrbitCamera).updateEach(([orbit]) => {
    if (indoors) {
      const turn = wrapAngle(orbit.yaw + yawDelta - INTERIOR_FRONT_YAW)
      orbit.yaw =
        INTERIOR_FRONT_YAW + clamp(turn, -room.YAW_RANGE, room.YAW_RANGE)
      orbit.pitch = clamp(
        orbit.pitch + pitchDelta,
        room.PITCH - room.PITCH_RANGE,
        room.PITCH + room.PITCH_RANGE,
      )
      orbit.distance = clamp(
        orbit.distance + zoomDelta,
        room.MIN_DISTANCE,
        room.DISTANCE,
      )
      return
    }
    orbit.yaw = wrapAngle(orbit.yaw + yawDelta)
    orbit.pitch = clamp(orbit.pitch + pitchDelta, c.MIN_PITCH, c.MAX_PITCH)
    orbit.distance = clamp(
      orbit.distance + zoomDelta,
      c.MIN_DISTANCE,
      c.MAX_DISTANCE,
    )
  })
}
