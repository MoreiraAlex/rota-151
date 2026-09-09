import { Position, PhysicsBody } from '../traits'
import { isPhysicsReady, getRapierWorld } from '../physics/physicsWorld'

/**
 * Copia a translação de cada corpo Rapier de volta para o trait Position.
 * É o handoff da física para o resto da simulação e para a view.
 *
 * Headless. Fase: simulation, último system (depois do physicsStepSystem).
 */
export function syncPhysicsSystem(context) {
  if (!isPhysicsReady()) return

  const { world } = context
  const rapierWorld = getRapierWorld()

  world.query(PhysicsBody, Position).updateEach(([body, position]) => {
    if (body.bodyHandle < 0) return
    const rigidBody = rapierWorld.getRigidBody(body.bodyHandle)
    if (!rigidBody) return

    const translation = rigidBody.translation()
    position.x = translation.x
    position.y = translation.y
    position.z = translation.z
  })
}
