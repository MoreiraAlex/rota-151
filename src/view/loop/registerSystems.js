import { registerSystem, GAME_PHASES } from '@/core/systems'
import { inputSystem } from '@/core/systems/inputSystem'
import { cameraControlSystem } from '@/core/systems/cameraControlSystem'
import { movementSystem } from '@/core/systems/movementSystem'
import { syncTransformSystem } from '@/view/systems/syncTransformSystem'
import { cameraFollowSystem } from '@/view/systems/cameraFollowSystem'

let registered = false

/**
 * Registra os systems concretos nas fases do loop. É composição (conhece core
 * e view), por isso vive na camada view — não no core headless.
 *
 * A ordem dentro de cada fase importa:
 * - simulation: cameraControlSystem antes de movementSystem (movimento é
 *   relativo ao yaw da câmera)
 * - presentation: syncTransformSystem antes de cameraFollowSystem (a câmera lê
 *   a posição já sincronizada do alvo)
 */
export function registerGameSystems() {
  if (registered) return
  registered = true

  registerSystem(GAME_PHASES.INPUT, inputSystem)
  registerSystem(GAME_PHASES.SIMULATION, cameraControlSystem)
  registerSystem(GAME_PHASES.SIMULATION, movementSystem)
  registerSystem(GAME_PHASES.PRESENTATION, syncTransformSystem)
  registerSystem(GAME_PHASES.PRESENTATION, cameraFollowSystem)
}
