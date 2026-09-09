import { GAME_CONFIG } from '../gameConfig'
import { Velocity, PhysicsBody, CharacterController, Grounded } from '../traits'
import {
  isPhysicsReady,
  getRapierWorld,
  getCharacterController,
} from '../physics/physicsWorld'

/**
 * Aplica gravidade e pulo à Velocity vertical, resolve o movimento do
 * personagem contra o mundo com o KinematicCharacterController do Rapier e
 * agenda a nova translação do corpo. Atualiza a tag Grounded.
 *
 * Headless (Rapier-compat roda em Node). Fase: simulation, depois do
 * movementSystem e antes do physicsStepSystem.
 */
export function characterPhysicsSystem(context) {
  if (!isPhysicsReady()) return

  const { world, delta } = context
  const input = context.input ?? {}
  const cfg = GAME_CONFIG.PHYSICS
  const char = cfg.CHARACTER
  const rapierWorld = getRapierWorld()
  const controller = getCharacterController()

  world
    .query(CharacterController, PhysicsBody, Velocity)
    .updateEach(([body, vel], entity) => {
      if (body.bodyHandle < 0) return

      const rigidBody = rapierWorld.getRigidBody(body.bodyHandle)
      const collider = rapierWorld.getCollider(body.colliderHandle)
      if (!rigidBody || !collider) return

      const wasGrounded = entity.has(Grounded)

      if (wasGrounded && vel.y <= 0) {
        vel.y = char.GROUNDED_STICK
      } else {
        vel.y += cfg.GRAVITY * delta
      }

      if (input.jump && wasGrounded) {
        vel.y = char.JUMP_SPEED
      }

      controller.computeColliderMovement(collider, {
        x: vel.x * delta,
        y: vel.y * delta,
        z: vel.z * delta,
      })
      const movement = controller.computedMovement()
      const translation = rigidBody.translation()
      rigidBody.setNextKinematicTranslation({
        x: translation.x + movement.x,
        y: translation.y + movement.y,
        z: translation.z + movement.z,
      })

      const isGrounded = controller.computedGrounded()
      if (isGrounded && !wasGrounded) entity.add(Grounded)
      if (!isGrounded && wasGrounded) entity.remove(Grounded)
      if (isGrounded && vel.y < 0) vel.y = 0
    })
}
