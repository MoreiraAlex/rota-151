import { describe, it, expect } from 'vitest'
import { makeWorld } from '@/test/makeWorld'
import { GAME_CONFIG } from '@/core/gameConfig'
import {
  Position,
  Rotation,
  Velocity,
  InputState,
  OrbitCamera,
} from '@/core/traits'
import { movementSystem } from './movementSystem'

const SPEED = GAME_CONFIG.PLAYER.MOVE_SPEED

function setup(yaw = 0) {
  const { world, player, camera } = makeWorld()
  camera.set(OrbitCamera, { yaw })
  const tick = (intent) => {
    player.set(InputState, intent)
    movementSystem({ world, delta: 1 / 60, input: {} })
  }
  return { player, tick }
}

describe('movementSystem', () => {
  it('com yaw = 0, "frente" (z = -1) vira velocidade -z', () => {
    const { player, tick } = setup(0)
    tick({ x: 0, z: -1 })
    const vel = player.get(Velocity)
    expect(vel.z).toBeCloseTo(-SPEED)
    expect(vel.x).toBeCloseTo(0)
  })

  it('com yaw = 0, "direita" (x = 1) vira velocidade +x — sem inversão', () => {
    const { player, tick } = setup(0)
    tick({ x: 1, z: 0 })
    const vel = player.get(Velocity)
    expect(vel.x).toBeCloseTo(SPEED)
    expect(vel.z).toBeCloseTo(0)
  })

  it('com yaw = π/2, "frente" é relativo à câmera (vira -x)', () => {
    const { player, tick } = setup(Math.PI / 2)
    tick({ x: 0, z: -1 })
    const vel = player.get(Velocity)
    expect(vel.x).toBeCloseTo(-SPEED)
    expect(vel.z).toBeCloseTo(0)
  })

  it('gira Rotation.y em direção ao movimento', () => {
    const { player, tick } = setup(0)
    for (let i = 0; i < 120; i++) tick({ x: 1, z: 0 })
    // movendo em +x, facing = atan2(1, 0) = π/2
    expect(player.get(Rotation).y).toBeCloseTo(Math.PI / 2, 1)
  })

  it('não escreve em Position (quem move é a física)', () => {
    const { player, tick } = setup(0)
    const before = { ...player.get(Position) }
    for (let i = 0; i < 60; i++) tick({ x: 1, z: 1 })
    expect(player.get(Position)).toMatchObject(before)
  })
})
