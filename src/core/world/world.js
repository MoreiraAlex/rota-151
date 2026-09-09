import { createWorld } from 'koota'
import { GAME_CONFIG } from '../gameConfig'
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
} from '../traits'

export const world = createWorld()

export const playerEntity = world.spawn(
  Position({ x: 0, y: 2, z: 0 }),
  Rotation,
  Velocity,
  InputState,
  InputControlled,
  CameraTarget,
  PhysicsBody,
  CharacterController,
)

export const cameraEntity = world.spawn(
  OrbitCamera({
    yaw: GAME_CONFIG.CAMERA.INITIAL_YAW,
    pitch: GAME_CONFIG.CAMERA.INITIAL_PITCH,
    distance: GAME_CONFIG.CAMERA.INITIAL_DISTANCE,
  }),
)
