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
} from '../traits'

export const world = createWorld()

export const playerEntity = world.spawn(
  Position({ x: 0, y: 0.5, z: 0 }),
  Rotation,
  Velocity,
  InputState,
  InputControlled,
  CameraTarget,
)

export const cameraEntity = world.spawn(
  OrbitCamera({
    yaw: GAME_CONFIG.CAMERA.INITIAL_YAW,
    pitch: GAME_CONFIG.CAMERA.INITIAL_PITCH,
    distance: GAME_CONFIG.CAMERA.INITIAL_DISTANCE,
  }),
)
