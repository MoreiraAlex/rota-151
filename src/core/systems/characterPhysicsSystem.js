import { GAME_CONFIG } from '../gameConfig'
import {
  Velocity,
  Rotation,
  PhysicsBody,
  CharacterController,
  MovementStats,
  Grounded,
} from '../traits'
import {
  isPhysicsReady,
  getRapierWorld,
  getCharacterController,
} from '../physics/physicsWorld'
import { axisQuaternion } from '../physics/colliders'

/**
 * Aplica gravidade e pulo à Velocity vertical, resolve o movimento do
 * personagem contra o mundo com o KinematicCharacterController do Rapier e
 * agenda a nova translação/rotação do corpo. Atualiza a tag Grounded.
 *
 * O corpo físico também gira junto com `Rotation.y` (girar só translação
 * bastava enquanto a cápsula era sempre em pé — radialmente simétrica em Y,
 * então a rotação do corpo não importava pra colisão; uma cápsula deitada
 * (`CharacterController.capsuleAxis` 'x'/'z') deixa de ser simétrica, e sem
 * isso ficaria travada num eixo do mundo em vez de acompanhar a frente da
 * criatura ao virar).
 *
 * `GROUNDED_STICK`/gravidade vêm do config global (epsilon técnico do
 * algoritmo de snap-to-ground, igual pra toda entidade); a força do pulo
 * (`jumpSpeed`) vem de MovementStats — dado por entidade.
 *
 * Headless (Rapier-compat roda em Node). Fase: simulation, depois do
 * movementSystem e antes do physicsStepSystem.
 */
export function characterPhysicsSystem(context) {
  if (!isPhysicsReady()) return

  const { world, delta } = context
  const input = context.input ?? {}
  const cfg = GAME_CONFIG.PHYSICS
  const rapierWorld = getRapierWorld()
  const controller = getCharacterController()

  world
    .query(CharacterController, MovementStats, PhysicsBody, Velocity, Rotation)
    .updateEach(([, stats, body, vel, rot], entity) => {
      if (body.bodyHandle < 0) return

      const rigidBody = rapierWorld.getRigidBody(body.bodyHandle)
      const collider = rapierWorld.getCollider(body.colliderHandle)
      if (!rigidBody || !collider) return

      const wasGrounded = entity.has(Grounded)

      if (wasGrounded && vel.y <= 0) {
        vel.y = cfg.CHARACTER.GROUNDED_STICK
      } else {
        vel.y += cfg.GRAVITY * delta
      }

      if (input.jump && wasGrounded) {
        vel.y = stats.jumpSpeed
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
      rigidBody.setNextKinematicRotation(axisQuaternion('y', rot.y))

      const isGrounded = controller.computedGrounded()
      if (isGrounded && !wasGrounded) entity.add(Grounded)
      if (!isGrounded && wasGrounded) entity.remove(Grounded)
      if (isGrounded && vel.y < 0) vel.y = 0
    })
}
