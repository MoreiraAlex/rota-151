import { describe, it, expect } from 'vitest'
import { world, playerEntity, cameraEntity } from './world'
import {
  getSpecies,
  PLAYER_SPECIES_ID,
  resolveSpeciesKind,
} from '@/core/data/species'
import { getItem } from '@/core/data/items'
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
  Inventory,
  Party,
  OrbitCamera,
} from '@/core/traits'

// Segue PLAYER_SPECIES_ID (não fixo numa espécie) — o teste valida que o player
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
      Inventory,
      Party,
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

  it('vitals do player vêm de species.stats.hp/.energy (espécie migrada) ou species.vitals (espécie antiga), ou do default do trait se não tiver nenhum dos dois', () => {
    // Mesma ordem de resolução de `vitalsFromSpecies` (core/traits/
    // components/vitals.js) — `stats.hp`/`.energy` ganha quando existe
    // (espécies novas, ex.: `boy`/`bulbasaur`/`charmander`), senão cai
    // pro formato antigo (`vitals.maxHp`/`.maxStamina`), senão pro default do próprio trait.
    const vitals = playerEntity.get(Vitals)
    const expectedMaxHp =
      PLAYER_SPECIES.stats?.hp?.stat ?? PLAYER_SPECIES.vitals?.maxHp ?? 100
    const expectedMaxStamina =
      PLAYER_SPECIES.stats?.energy?.stat ??
      PLAYER_SPECIES.vitals?.maxStamina ??
      100

    expect(vitals.maxHp).toBe(expectedMaxHp)
    expect(vitals.hp).toBe(expectedMaxHp) // começa cheio
    expect(vitals.maxStamina).toBe(expectedMaxStamina)
    expect(vitals.stamina).toBe(expectedMaxStamina)
  })

  // Sem conteúdo fixo (kit e time mudam): só as regras de consistência.
  it('o player começa com um item do inventário equipado na mão', () => {
    const { itemId } = playerEntity.get(HeldItem)
    expect(getItem(itemId)).not.toBeNull()
    expect(playerEntity.get(Inventory).itemIds).toContain(itemId)
  })

  it('todo item do inventário inicial existe no registro', () => {
    for (const id of playerEntity.get(Inventory).itemIds) {
      expect(getItem(id), id).not.toBeNull()
    }
  })

  it('o time inicial só tem criaturas (kind pokemon) do registro', () => {
    for (const id of Object.values(playerEntity.get(Party))) {
      if (id === null) continue
      expect(resolveSpeciesKind(getSpecies(id)), id).toBe('pokemon')
    }
  })

  it('a câmera tem OrbitCamera e não é o player', () => {
    expect(cameraEntity.has(OrbitCamera)).toBe(true)
    expect(cameraEntity.has(InputControlled)).toBe(false)
  })

  it('só existe um alvo de câmera', () => {
    expect(world.query(CameraTarget).length).toBe(1)
  })
})
