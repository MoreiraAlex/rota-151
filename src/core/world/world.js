import { createWorld } from 'koota'
import {
  Position,
  Rotation,
  Velocity,
  InputState,
  InputControlled,
} from '../traits'

export const world = createWorld()

export const playerEntity = world.spawn(
  Position({ x: 0, y: 0.5, z: 0 }),
  Rotation,
  Velocity,
  InputState,
  InputControlled,
)
