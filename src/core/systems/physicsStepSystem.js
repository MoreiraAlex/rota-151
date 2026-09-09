import { isPhysicsReady, stepPhysics } from '../physics/physicsWorld'

/**
 * Avança o mundo Rapier um passo fixo. Precisa rodar depois de todos os
 * `computeColliderMovement` / `setNextKinematicTranslation` do tick.
 *
 * Headless. Fase: simulation, depois do characterPhysicsSystem.
 */
export function physicsStepSystem() {
  if (!isPhysicsReady()) return
  stepPhysics()
}
