import { registerSystem, GAME_PHASES } from '@/core/systems'
import { inputSystem } from '@/core/systems/inputSystem'
import { physicsBootstrapSystem } from '@/core/systems/physicsBootstrapSystem'
import { cameraControlSystem } from '@/core/systems/cameraControlSystem'
import { movementSystem } from '@/core/systems/movementSystem'
import { characterPhysicsSystem } from '@/core/systems/characterPhysicsSystem'
import { physicsStepSystem } from '@/core/systems/physicsStepSystem'
import { syncPhysicsSystem } from '@/core/systems/syncPhysicsSystem'
import { animationStateSystem } from '@/core/systems/animationStateSystem'
import { syncTransformSystem } from '@/view/systems/syncTransformSystem'
import { cameraFollowSystem } from '@/view/systems/cameraFollowSystem'
import { animationSystem } from '@/view/systems/animationSystem'

let registered = false

/**
 * Registra os systems concretos nas fases do loop. É composição (conhece core
 * e view), por isso vive na camada view — não no core headless.
 *
 * A ordem dentro da fase `simulation` é parte do comportamento:
 *   bootstrap → controle de câmera → movimento (Velocity) → character
 *   controller (KCC) → step do Rapier → sync de volta para Position →
 *   resolve o estado de animação (já com Velocity/Grounded atualizados).
 * Em `presentation`: sincroniza transforms, depois câmera, depois animação
 * (a ordem entre as duas últimas não importa — nenhuma lê a outra).
 */
export function registerGameSystems() {
  if (registered) return
  registered = true

  registerSystem(GAME_PHASES.INPUT, inputSystem)

  registerSystem(GAME_PHASES.SIMULATION, physicsBootstrapSystem)
  registerSystem(GAME_PHASES.SIMULATION, cameraControlSystem)
  registerSystem(GAME_PHASES.SIMULATION, movementSystem)
  registerSystem(GAME_PHASES.SIMULATION, characterPhysicsSystem)
  registerSystem(GAME_PHASES.SIMULATION, physicsStepSystem)
  registerSystem(GAME_PHASES.SIMULATION, syncPhysicsSystem)
  registerSystem(GAME_PHASES.SIMULATION, animationStateSystem)

  registerSystem(GAME_PHASES.PRESENTATION, syncTransformSystem)
  registerSystem(GAME_PHASES.PRESENTATION, cameraFollowSystem)
  registerSystem(GAME_PHASES.PRESENTATION, animationSystem)
}
