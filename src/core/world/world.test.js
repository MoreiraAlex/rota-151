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
  Vitals,
  HeldItem,
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
      Vitals,
      HeldItem,
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

  it('vitals do player vêm da espécie configurada, ou do default do trait se a espécie não tiver', () => {
    const vitals = playerEntity.get(Vitals)
    if (PLAYER_SPECIES.vitals) {
      expect(vitals.maxHp).toBe(PLAYER_SPECIES.vitals.maxHp)
      expect(vitals.hp).toBe(PLAYER_SPECIES.vitals.maxHp) // começa cheio
      expect(vitals.maxStamina).toBe(PLAYER_SPECIES.vitals.maxStamina)
      expect(vitals.stamina).toBe(PLAYER_SPECIES.vitals.maxStamina)
    } else {
      expect(vitals.hp).toBe(vitals.maxHp)
      expect(vitals.stamina).toBe(vitals.maxStamina)
    }
  })

  it('o player começa sem item em mãos', () => {
    expect(playerEntity.get(HeldItem).itemId).toBeNull()
  })

  it('a câmera tem OrbitCamera e não é o player', () => {
    expect(cameraEntity.has(OrbitCamera)).toBe(true)
    expect(cameraEntity.has(InputControlled)).toBe(false)
  })

  it('só existe um alvo de câmera', () => {
    expect(world.query(CameraTarget).length).toBe(1)
  })
})
