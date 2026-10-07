import { getSpecies } from '../data/species'
import { rollIndividualValues } from '../data/species/stats'
import { createLevelState } from '../data/species/experience'
import { createMovesState } from '../data/species/moves'
import { GAME_CONFIG } from '../gameConfig'
import { gameplayRng } from '../rng'
import {
  CreatureLevel,
  CreatureMoves,
  IndividualValues,
  InventoryCell,
  OwnedBy,
  PARTY_SLOT_IDS,
  PartySlots,
  Pokemon,
  StoredFaint,
  StoredVitals,
  SummonedCreature,
  SummonedFrom,
} from '../traits'
import { findFreeCell, resolveInventoryCells } from './inventory'

/**
 * Registro de cada Pokémon e o time (docs/features/041-inventario-de-itens-e-
 * pokemon.md). Um Pokémon é uma entidade própria (`Pokemon`), do treinador
 * por `OwnedBy`; os 3 lugares do time são as relações `PartySlots` no
 * treinador. Quem não está em nenhum slot está no inventário, numa célula
 * da grade (`InventoryCell`).
 */

/**
 * Cria um Pokémon de `speciesId` para o `trainer`: IV sorteado, nível inicial
 * da espécie, kit de golpes da espécie, vida cheia. Nasce no inventário, na
 * primeira célula livre.
 * Devolve o registro, ou `null` pra espécie desconhecida.
 */
export function criarPokemon(world, trainer, speciesId, rng = gameplayRng) {
  const species = getSpecies(speciesId)
  if (!species) return null

  const individualValues =
    species.stats?.hp?.base != null
      ? rollIndividualValues(rng, {
          min: GAME_CONFIG.BATTLE.IV_MIN,
          max: GAME_CONFIG.BATTLE.IV_MAX,
        })
      : {}

  return world.spawn(
    Pokemon({ speciesId }),
    IndividualValues(individualValues),
    CreatureLevel(createLevelState(species, species.level ?? 1)),
    CreatureMoves(createMovesState(species)),
    StoredVitals,
    OwnedBy(trainer),
    InventoryCell({ index: findFreeCell(world, trainer) }),
  )
}

/** O Pokémon no `slot` do time do `trainer`, ou `null`. */
export function findPartyPokemon(trainer, slot) {
  const relation = PartySlots[slot]
  if (!trainer?.isAlive?.() || !relation) return null
  const pokemon = trainer.targetFor(relation)
  return pokemon?.isAlive() ? pokemon : null
}

/** Em que slot do time do `trainer` está o `pokemon`, ou `null` (inventário). */
export function resolvePartySlot(trainer, pokemon) {
  if (!pokemon) return null
  return (
    PARTY_SLOT_IDS.find(
      (slot) => findPartyPokemon(trainer, slot) === pokemon,
    ) ?? null
  )
}

/** Todos os Pokémon do `trainer` (time e inventário). */
export function listOwnedPokemon(world, trainer) {
  if (!trainer) return []
  return world.query(Pokemon, OwnedBy(trainer)).filter((e) => e.isAlive())
}

/** Os Pokémon do `trainer` que estão no inventário (fora do time). */
export function listInventoryPokemon(world, trainer) {
  return listOwnedPokemon(world, trainer).filter(
    (pokemon) => resolvePartySlot(trainer, pokemon) == null,
  )
}

/**
 * Põe o `pokemon` no `slot` do time. Se o slot está ocupado, quem estava lá
 * troca de lugar: vai pro slot de onde o `pokemon` veio, ou pro inventário
 * (na célula que o `pokemon` deixou) se ele veio de lá. Pokémon de outro
 * treinador não entra. Devolve se mudou.
 *
 * A criatura em campo de quem saiu do slot é recolhida sozinha
 * (`partySummonSystem.js`).
 */
export function colocarNoTime(trainer, pokemon, slot) {
  if (!PartySlots[slot] || !pokemon?.isAlive?.()) return false
  if (pokemon.targetFor(OwnedBy) !== trainer) return false

  const fromSlot = resolvePartySlot(trainer, pokemon)
  if (fromSlot === slot) return false
  const occupant = findPartyPokemon(trainer, slot)
  const fromCell = pokemon.has(InventoryCell)
    ? pokemon.get(InventoryCell).index
    : null

  if (fromSlot) trainer.remove(PartySlots[fromSlot](pokemon))
  else if (fromCell != null) pokemon.remove(InventoryCell)
  trainer.add(PartySlots[slot](pokemon))

  if (!occupant) return true
  if (fromSlot) trainer.add(PartySlots[fromSlot](occupant))
  else if (fromCell != null) occupant.add(InventoryCell({ index: fromCell }))
  return true
}

/**
 * Tira o `pokemon` do time e põe no inventário — na célula `index`, se
 * dada e livre, ou na primeira livre. Se na `index` tem outro Pokémon, os
 * dois trocam de lugar (o outro entra no slot). Devolve se mudou.
 */
export function tirarDoTime(world, trainer, pokemon, index = null) {
  const slot = resolvePartySlot(trainer, pokemon)
  if (!slot) return false

  const cells = resolveInventoryCells(world, trainer)
  const occupant = index != null ? cells.get(index) : null
  if (occupant?.kind === 'creature') {
    return colocarNoTime(trainer, occupant.pokemon, slot)
  }

  trainer.remove(PartySlots[slot](pokemon))
  const cell = index != null && !occupant ? index : findFreeCell(world, trainer)
  pokemon.add(InventoryCell({ index: cell }))
  return true
}

/** O Pokémon está desmaiado fora de campo (não pode ser invocado)? */
export function isPokemonFainted(pokemon) {
  return !!pokemon?.has?.(StoredFaint)
}

/** O registro (`Pokemon`) de onde veio a criatura/esfera, ou `null`. */
export function resolvePokemonOf(entity) {
  if (!entity?.isAlive?.()) return null
  const pokemon = entity.targetFor(SummonedFrom)
  return pokemon?.isAlive() ? pokemon : null
}

/** A criatura em campo do `pokemon`, ou `null` se ele está na bola. */
export function findSummonedCreature(world, pokemon) {
  if (!pokemon) return null
  return (
    world
      .query(SummonedCreature, SummonedFrom(pokemon))
      .find((entity) => entity.isAlive()) ?? null
  )
}

/** A espécie do `pokemon` (id), ou `null`. */
export function resolvePokemonSpeciesId(pokemon) {
  return pokemon?.get?.(Pokemon)?.speciesId ?? null
}
