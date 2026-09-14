import { lerpAngle } from '../math'
import {
  Velocity,
  Rotation,
  InputState,
  InputControlled,
  MovementStats,
  OrbitCamera,
} from '../traits'

/**
 * Produz a velocidade horizontal desejada a partir do InputState e gira a
 * entidade na direção do movimento. NÃO integra Position — quem resolve o
 * movimento contra o mundo é o characterPhysicsSystem (Rapier KCC).
 *
 * A intenção do InputState está no espaço da câmera (x = direita, z = frente);
 * aqui ela é rotacionada pelo yaw de OrbitCamera para o espaço do mundo.
 * Velocidades vêm de MovementStats — dado por entidade (de
 * core/data/species/<id>/index.js, copiado no spawn), não config global.
 *
 * Headless. Fase: simulation, depois do cameraControlSystem e antes do
 * characterPhysicsSystem.
 */
export function movementSystem(context) {
  const { world, delta } = context

  const rig = world.queryFirst(OrbitCamera)
  const yaw = rig ? rig.get(OrbitCamera).yaw : 0
  const sinYaw = Math.sin(yaw)
  const cosYaw = Math.cos(yaw)

  world
    .query(InputControlled, InputState, MovementStats, Velocity, Rotation)
    .updateEach(([input, stats, vel, rot]) => {
      // Rotaciona a intenção (espaço da câmera) para o espaço do mundo.
      // x = direita da câmera, z = frente da câmera (InputState: frente = -z).
      const worldX = input.x * cosYaw + input.z * sinYaw
      const worldZ = -input.x * sinYaw + input.z * cosYaw
      const speed = input.run ? stats.runSpeed : stats.walkSpeed

      vel.x = worldX * speed
      vel.z = worldZ * speed

      if (worldX !== 0 || worldZ !== 0) {
        const facing = Math.atan2(worldX, worldZ)
        rot.y = lerpAngle(rot.y, facing, stats.turnSpeed * delta)
      }
    })
}
