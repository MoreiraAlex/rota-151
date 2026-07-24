import { createWorld } from 'koota'
import { Position, Rotation } from '../traits/components/Transform'

export const world = createWorld()

export const cubeEntity = world.spawn(Position, Rotation)
