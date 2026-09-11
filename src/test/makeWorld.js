import { createWorld } from 'koota'
import { GAME_CONFIG } from '@/core/gameConfig'
import {
  Position,
  Rotation,
  Velocity,
  InputState,
  InputControlled,
  OrbitCamera,
  CameraTarget,
  PhysicsBody,
  CharacterController,
} from '@/core/traits'

/**
 * Cria um world koota isolado para testes, com um player e uma câmera compostos
 * como em `core/world/world.js` — mas sem o singleton, para os testes não
 * vazarem estado entre si.
 *
 * Retorna `{ world, player, camera }`.
 */
export function makeWorld({ playerPosition = { x: 0, y: 2, z: 0 } } = {}) {
  const world = createWorld()

  const player = world.spawn(
    Position(playerPosition),
    Rotation,
    Velocity,
    InputState,
    InputControlled,
    CameraTarget,
    PhysicsBody,
    CharacterController,
  )

  const camera = world.spawn(
    OrbitCamera({
      yaw: GAME_CONFIG.CAMERA.INITIAL_YAW,
      pitch: GAME_CONFIG.CAMERA.INITIAL_PITCH,
      distance: GAME_CONFIG.CAMERA.INITIAL_DISTANCE,
    }),
  )

  return { world, player, camera }
}
