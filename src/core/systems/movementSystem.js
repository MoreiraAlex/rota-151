import { GAME_CONFIG } from '../gameConfig'
import { lerpAngle } from '../math'
import {
  Velocity,
  Rotation,
  InputState,
  InputControlled,
  OrbitCamera,
} from '../traits'

/**
 * Produz a velocidade horizontal desejada a partir do InputState e gira a
 * entidade na direção do movimento. NÃO integra Position — quem resolve o
 * movimento contra o mundo é o characterPhysicsSystem (Rapier KCC).
 *
 * A intenção do InputState está no espaço da câmera (x = direita, z = frente);
 * aqui ela é rotacionada pelo yaw de OrbitCamera para o espaço do mundo.
 *
 * Headless. Fase: simulation, depois do cameraControlSystem e antes do
 * characterPhysicsSystem.
 */
export function movementSystem(context) {
  const { world, delta } = context
  const { WALK_SPEED, RUN_SPEED, TURN_SPEED } = GAME_CONFIG.PLAYER

  const rig = world.queryFirst(OrbitCamera)
  const yaw = rig ? rig.get(OrbitCamera).yaw : 0
  const sinYaw = Math.sin(yaw)
  const cosYaw = Math.cos(yaw)

  world
    .query(InputControlled, InputState, Velocity, Rotation)
    .updateEach(([input, vel, rot]) => {
      // Rotaciona a intenção (espaço da câmera) para o espaço do mundo.
      // x = direita da câmera, z = frente da câmera (InputState: frente = -z).
      const worldX = input.x * cosYaw + input.z * sinYaw
      const worldZ = -input.x * sinYaw + input.z * cosYaw
      const speed = input.run ? RUN_SPEED : WALK_SPEED

      vel.x = worldX * speed
      vel.z = worldZ * speed

      if (worldX !== 0 || worldZ !== 0) {
        const facing = Math.atan2(worldX, worldZ)
        rot.y = lerpAngle(rot.y, facing, TURN_SPEED * delta)
      }
    })
}
