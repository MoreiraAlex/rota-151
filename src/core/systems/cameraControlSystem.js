import { GAME_CONFIG } from '../gameConfig'
import { clamp, wrapAngle } from '../math'
import { OrbitCamera } from '../traits'

/**
 * Atualiza a órbita da câmera (trait OrbitCamera) a partir do movimento do
 * mouse e do scroll (context.input, preenchido pelo pointerInput).
 *
 * - cameraYaw / cameraPitch: deltas de mouse já acumulados pelo adapter,
 *   convertidos por MOUSE_SENSITIVITY. Mouse para a direita gira a visão para a
 *   direita (yaw diminui); mouse para baixo olha para baixo (pitch aumenta).
 * - zoom: passos de scroll, escalados por ZOOM_SPEED.
 *
 * Mirando (`input.aiming`, botão direito segurado — lock-on estilo Zelda,
 * ver docs/features/016-mira-e-arremesso.md), o mouse para de girar a
 * câmera: `orbit.yaw`/`pitch` ficam congelados (quem passa a girar a
 * câmera é `cameraFollowSystem.js`, automaticamente, pra manter o ponto
 * travado em vista — não o jogador via mouse). Soltar o botão volta a
 * aceitar deltas de mouse normalmente, a partir de onde `orbit.yaw`/
 * `pitch` ficaram (sem salto — nunca foram alterados enquanto travado).
 * O zoom (scroll) continua livre mesmo mirando. (Chegou a se tentar mouse
 * livre com sensibilidade reduzida aqui — rodadas 14–15 — mas não deu o
 * resultado esperado; revertido a pedido do usuário de volta pro
 * congelamento, enquanto a proposta é reformulada.)
 *
 * O yaw é livre (só normalizado); o pitch é limitado por MIN_PITCH / MAX_PITCH.
 *
 * Headless. Fase: simulation, antes do movementSystem (que lê o yaw resultante).
 */
export function cameraControlSystem(context) {
  const { world } = context
  const input = context.input ?? {}
  const c = GAME_CONFIG.CAMERA

  const yawDelta = input.aiming
    ? 0
    : -(input.cameraYaw ?? 0) * c.MOUSE_SENSITIVITY
  const pitchDelta = input.aiming
    ? 0
    : (input.cameraPitch ?? 0) * c.MOUSE_SENSITIVITY
  const zoomDelta = (input.zoom ?? 0) * c.ZOOM_SPEED

  world.query(OrbitCamera).updateEach(([orbit]) => {
    orbit.yaw = wrapAngle(orbit.yaw + yawDelta)
    orbit.pitch = clamp(orbit.pitch + pitchDelta, c.MIN_PITCH, c.MAX_PITCH)
    orbit.distance = clamp(
      orbit.distance + zoomDelta,
      c.MIN_DISTANCE,
      c.MAX_DISTANCE,
    )
  })
}
