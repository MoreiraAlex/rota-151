import { GAME_CONFIG } from '../gameConfig'
import { TEST_LEVEL } from '../data/testLevel'
import { getRapier, getRapierWorld } from './physicsWorld'

/**
 * Quaternion de um giro em torno de um único eixo.
 */
export function axisQuaternion(axis, angle) {
  const half = angle / 2
  const s = Math.sin(half)
  return {
    x: axis === 'x' ? s : 0,
    y: axis === 'y' ? s : 0,
    z: axis === 'z' ? s : 0,
    w: Math.cos(half),
  }
}

/**
 * Cria os colliders estáticos do nível (chão + obstáculos) a partir de
 * TEST_LEVEL. Corpos fixos, colliders cuboides.
 */
export function createStaticLevel() {
  const RAPIER = getRapier()
  const world = getRapierWorld()

  const ground = TEST_LEVEL.ground
  const groundBody = world.createRigidBody(
    RAPIER.RigidBodyDesc.fixed().setTranslation(0, -ground.thickness / 2, 0),
  )
  world.createCollider(
    RAPIER.ColliderDesc.cuboid(
      ground.size / 2,
      ground.thickness / 2,
      ground.size / 2,
    ),
    groundBody,
  )

  for (const obstacle of TEST_LEVEL.obstacles) {
    const [w, h, d] = obstacle.size
    let desc = RAPIER.RigidBodyDesc.fixed().setTranslation(
      obstacle.position[0],
      obstacle.position[1],
      obstacle.position[2],
    )
    if (obstacle.rotation) {
      desc = desc.setRotation(
        axisQuaternion(obstacle.rotation.axis, obstacle.rotation.angle),
      )
    }
    const body = world.createRigidBody(desc)
    world.createCollider(RAPIER.ColliderDesc.cuboid(w / 2, h / 2, d / 2), body)
  }
}

/**
 * Cria o corpo cinemático + collider cápsula do personagem na posição dada.
 * Retorna os handles para guardar no trait PhysicsBody.
 */
export function createCharacterBody(position) {
  const RAPIER = getRapier()
  const world = getRapierWorld()
  const char = GAME_CONFIG.PHYSICS.CHARACTER

  const body = world.createRigidBody(
    RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(
      position.x,
      position.y,
      position.z,
    ),
  )
  const collider = world.createCollider(
    RAPIER.ColliderDesc.capsule(char.CAPSULE_HALF_HEIGHT, char.CAPSULE_RADIUS),
    body,
  )

  return { bodyHandle: body.handle, colliderHandle: collider.handle }
}
