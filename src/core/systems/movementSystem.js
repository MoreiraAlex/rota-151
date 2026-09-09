import { GAME_CONFIG } from '../gameConfig'
import {
  Position,
  Rotation,
  Velocity,
  InputState,
  InputControlled,
  OrbitCamera,
} from '../traits'

const TWO_PI = Math.PI * 2

/**
 * Interpola um ângulo (radianos) pelo caminho mais curto.
 */
function lerpAngle(current, target, t) {
  let delta = (target - current) % TWO_PI
  if (delta > Math.PI) delta -= TWO_PI
  if (delta < -Math.PI) delta += TWO_PI
  return current + delta * Math.min(1, t)
}

/**
 * Produz Velocity a partir de InputState e integra em Position. Gira a entidade
 * suavemente na direção do movimento.
 *
 * A intenção do InputState está no espaço da câmera (x = direita, z = frente);
 * aqui ela é rotacionada pelo yaw de OrbitCamera para o espaço do mundo.
 *
 * Headless. Fase: simulation (passo fixo), depois do cameraControlSystem.
 */
export function movementSystem(context) {
  const { world, delta } = context
  const { MOVE_SPEED, TURN_SPEED } = GAME_CONFIG.PLAYER

  const rig = world.queryFirst(OrbitCamera)
  const yaw = rig ? rig.get(OrbitCamera).yaw : 0
  const sinYaw = Math.sin(yaw)
  const cosYaw = Math.cos(yaw)

  world
    .query(InputControlled, InputState, Position, Velocity, Rotation)
    .updateEach(([input, pos, vel, rot]) => {
      // Rotaciona a intenção (espaço da câmera) para o espaço do mundo.
      // x = direita da câmera, z = frente da câmera (InputState: frente = -z).
      const worldX = input.x * cosYaw + input.z * sinYaw
      const worldZ = -input.x * sinYaw + input.z * cosYaw

      vel.x = worldX * MOVE_SPEED
      vel.z = worldZ * MOVE_SPEED

      pos.x += vel.x * delta
      pos.z += vel.z * delta

      if (vel.x !== 0 || vel.z !== 0) {
        const facing = Math.atan2(vel.x, vel.z)
        rot.y = lerpAngle(rot.y, facing, TURN_SPEED * delta)
      }
    })
}
