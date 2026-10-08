import { beforeAll, describe, it, expect } from 'vitest'
import { world, playerEntity, cameraEntity } from './world'
import {
  getSpecies,
  listSpecies,
  PLAYER_SPECIES_ID,
  resolveSpeciesKind,
} from '@/core/data/species'
import { getItem } from '@/core/data/items'
import { countItem } from '@/core/actions/inventory'
import { findPartyPokemon, listOwnedPokemon } from '@/core/actions/pokemon'
import { prepararTreinador } from '@/core/actions/save'
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
  PARTY_SLOT_IDS,
  Pokemon,
  OrbitCamera,
} from '@/core/traits'

// Segue PLAYER_SPECIES_ID (não fixo numa espécie) — o teste valida que o player
// vem da espécie configurada como jogador, seja lá qual for no momento.
const PLAYER_SPECIES = getSpecies(PLAYER_SPECIES_ID)

describe('world (singleton)', () => {
  // Primeira entrada (sem save): o kit inicial (docs/features/044-*.md).
  beforeAll(() => {
    prepararTreinador(world, playerEntity, null)
  })

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
    expect(countItem(playerEntity, itemId)).toBeGreaterThan(0)
  })

  it('todo item do inventário inicial existe no registro', () => {
    for (const [id, amount] of Object.entries(
      playerEntity.get(Inventory).counts,
    )) {
      expect(getItem(id), id).not.toBeNull()
      expect(amount, id).toBeGreaterThan(0)
    }
  })

  it('começa com um Pokémon de cada espécie (kind pokemon), todos do player', () => {
    const owned = listOwnedPokemon(world, playerEntity)
    const speciesIds = owned.map((pokemon) => pokemon.get(Pokemon).speciesId)
    const expected = listSpecies()
      .filter((species) => resolveSpeciesKind(species) === 'pokemon')
      .map((species) => species.id)
    expect([...speciesIds].sort()).toEqual([...expected].sort())
  })

  it('o time inicial só tem Pokémon do próprio player', () => {
    const owned = listOwnedPokemon(world, playerEntity)
    for (const slot of PARTY_SLOT_IDS) {
      const pokemon = findPartyPokemon(playerEntity, slot)
      if (pokemon) expect(owned).toContain(pokemon)
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
