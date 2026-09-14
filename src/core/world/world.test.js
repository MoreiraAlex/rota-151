import { describe, it, expect } from 'vitest'
import { world, playerEntity, cameraEntity } from './world'
import { getSpecies, PLAYER_SPECIES_ID } from '@/core/data/species'
import {
  Position,
  Rotation,
  Velocity,
  InputState,
  InputControlled,
  MovementStats,
  CameraTarget,
  PhysicsBody,
  CharacterController,
  AnimationState,
  ActionState,
  OrbitCamera,
} from '@/core/traits'

// Segue PLAYER_SPECIES_ID (não fixo em 'fox') — o teste valida que o player
// vem da espécie configurada como jogador, seja lá qual for no momento.
const PLAYER_SPECIES = getSpecies(PLAYER_SPECIES_ID)

describe('world (singleton)', () => {
  it('o player compõe os traits esperados', () => {
    for (const t of [
      Position,
      Rotation,
      Velocity,
      InputState,
      InputControlled,
      MovementStats,
      CameraTarget,
      PhysicsBody,
      CharacterController,
      AnimationState,
      ActionState,
    ]) {
      expect(playerEntity.has(t)).toBe(true)
    }
  })

  it('o player começa acima do chão com corpo físico não criado', () => {
    expect(playerEntity.get(Position).y).toBeGreaterThan(0)
    expect(playerEntity.get(PhysicsBody).bodyHandle).toBe(-1)
  })

  it('corpo e movimento do player vêm da espécie configurada, não de constante fixa', () => {
    // body carrega mais campos do que o trait CharacterController usa
    // (modelOffset é da renderização, não da física) — compara só os campos
    // que o trait de fato tem.
    const { capsuleRadius, capsuleHalfHeight, capsuleAxis } =
      PLAYER_SPECIES.body
    expect(playerEntity.get(CharacterController)).toMatchObject({
      capsuleRadius,
      capsuleHalfHeight,
      capsuleAxis,
    })
    expect(playerEntity.get(MovementStats)).toMatchObject(
      PLAYER_SPECIES.movement,
    )
  })

  it('a câmera tem OrbitCamera e não é o player', () => {
    expect(cameraEntity.has(OrbitCamera)).toBe(true)
    expect(cameraEntity.has(InputControlled)).toBe(false)
  })

  it('só existe um alvo de câmera', () => {
    expect(world.query(CameraTarget).length).toBe(1)
  })
})
