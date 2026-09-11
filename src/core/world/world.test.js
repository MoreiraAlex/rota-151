import { describe, it, expect } from 'vitest'
import { world, playerEntity, cameraEntity } from './world'
import {
  Position,
  Rotation,
  Velocity,
  InputState,
  InputControlled,
  CameraTarget,
  PhysicsBody,
  CharacterController,
  OrbitCamera,
} from '@/core/traits'

describe('world (singleton)', () => {
  it('o player compõe os traits esperados', () => {
    for (const t of [
      Position,
      Rotation,
      Velocity,
      InputState,
      InputControlled,
      CameraTarget,
      PhysicsBody,
      CharacterController,
    ]) {
      expect(playerEntity.has(t)).toBe(true)
    }
  })

  it('o player começa acima do chão com corpo físico não criado', () => {
    expect(playerEntity.get(Position).y).toBeGreaterThan(0)
    expect(playerEntity.get(PhysicsBody).bodyHandle).toBe(-1)
  })

  it('a câmera tem OrbitCamera e não é o player', () => {
    expect(cameraEntity.has(OrbitCamera)).toBe(true)
    expect(cameraEntity.has(InputControlled)).toBe(false)
  })

  it('só existe um alvo de câmera', () => {
    expect(world.query(CameraTarget).length).toBe(1)
  })
})
