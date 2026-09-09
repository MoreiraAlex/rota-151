import { GAME_CONFIG } from '../gameConfig'
import {
  Position,
  Rotation,
  Velocity,
  InputState,
  InputControlled,
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
 * Headless. Fase: simulation (passo fixo).
 * Movimento alinhado aos eixos do mundo — câmera-relativo fica para depois.
 */
export function movementSystem(context) {
  const { world, delta } = context
  const { MOVE_SPEED, TURN_SPEED } = GAME_CONFIG.PLAYER

  world
    .query(InputControlled, InputState, Position, Velocity, Rotation)
    .updateEach(([input, pos, vel, rot]) => {
      vel.x = input.x * MOVE_SPEED
      vel.z = input.z * MOVE_SPEED

      pos.x += vel.x * delta
      pos.z += vel.z * delta

      if (vel.x !== 0 || vel.z !== 0) {
        const facing = Math.atan2(vel.x, vel.z)
        rot.y = lerpAngle(rot.y, facing, TURN_SPEED * delta)
      }
    })
}
