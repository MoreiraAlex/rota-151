import { getSpecies } from '../data/species'
import { cloneMovesState } from '../data/species/moves'
import {
  colocarNoTime,
  criarPokemon,
  findFreePartySlot,
  findPartyPokemon,
  findSummonedCreature,
  resolvePartySlot,
} from '../actions/pokemon'
import {
  resolveInventoryCapacity,
  resolveInventoryCells,
} from '../actions/inventory'
import { listStorable } from '../actions/conditions'
import {
  BallOnGround,
  Conditions,
  CreatureLevel,
  CreatureMoves,
  Fainted,
  IndividualValues,
  InventoryCell,
  Pokemon,
  StoredConditions,
  StoredFaint,
  StoredVitals,
  Vitals,
} from '../traits'

/**
 * Um Pokémon no save (docs/features/044-salvar-o-jogo.md) — forma em
 * `pokemonSaveSchema` (`saveFormat.js`).
 *
 * Em campo, ele é salvo como se tivesse sido recolhido: a vida,
 * as condições e o desmaio vêm da criatura (mesmo que `storeOutOfField`, do
 * `partySummonSystem.js`, guardaria), sem mexer no mundo. A bola caída no
 * chão (`BallOnGround`) não é salva: saiu do jogo, some.
 */

/** O `pokemon` (registro) do `trainer` como objeto salvo, ou `null`. */
export function serializePokemon(world, trainer, pokemon) {
  if (!pokemon?.isAlive?.() || pokemon.has(BallOnGround)) return null
  const location = resolveSaveLocation(trainer, pokemon)
  if (!location) return null

  const { uid, speciesId, ballId } = pokemon.get(Pokemon)
  const { level, xp } = pokemon.get(CreatureLevel)
  const creature = findSummonedCreature(world, pokemon)
  const outOfField = creature
    ? resolveFieldState(creature)
    : resolveStoredState(pokemon)

  return {
    id: uid,
    speciesId,
    ballId: ballId ?? null,
    level,
    xp,
    ivs: { ...pokemon.get(IndividualValues) },
    moves: cloneMovesState(pokemon.get(CreatureMoves)),
    ...outOfField,
    location,
  }
}

function resolveSaveLocation(trainer, pokemon) {
  const slot = resolvePartySlot(trainer, pokemon)
  if (slot) return { kind: 'party', slot }
  if (pokemon.has(InventoryCell)) {
    return { kind: 'inventory', cell: pokemon.get(InventoryCell).index }
  }
  return null
}

function resolveFieldState(creature) {
  const vitals = creature.get(Vitals)
  const conditions = listStorable(creature.get(Conditions)?.list)
  const fainted = creature.get(Fainted)
  return {
    storedVitals: vitals ? { ...vitals } : null,
    faintTimeLeft: fainted ? Math.max(0, fainted.timeLeft) : null,
    conditions: conditions.length ? conditions : null,
  }
}

function resolveStoredState(pokemon) {
  const vitals = pokemon.get(StoredVitals)?.vitals
  const faint = pokemon.get(StoredFaint)
  const conditions = listStorable(pokemon.get(StoredConditions)?.list)
  return {
    storedVitals: vitals ? { ...vitals } : null,
    faintTimeLeft: faint ? faint.timeLeft : null,
    conditions: conditions.length ? conditions : null,
  }
}

/**
 * Recria no mundo o Pokémon salvo, do `trainer`, no lugar salvo. Se o lugar
 * não está mais livre (slot ocupado, célula ocupada ou fora da grade), vai
 * pro primeiro slot livre do time ou do inventário. Espécie que não existe
 * mais fica de fora. Devolve o registro, ou `null`.
 */
export function restorePokemon(world, trainer, saved) {
  if (!getSpecies(saved.speciesId)) return null

  const pokemon = criarPokemon(world, trainer, saved.speciesId, {
    uid: saved.id,
    ballId: saved.ballId,
    individualValues: { ...saved.ivs },
    levelState: { level: saved.level, xp: saved.xp },
    moves: saved.moves,
  })
  if (!pokemon) return null

  if (saved.storedVitals) {
    pokemon.set(StoredVitals, { vitals: { ...saved.storedVitals } })
  }
  if (saved.faintTimeLeft != null) {
    pokemon.add(StoredFaint({ timeLeft: saved.faintTimeLeft }))
  }
  if (saved.conditions?.length) {
    pokemon.add(StoredConditions({ list: listStorable(saved.conditions) }))
  }

  placeRestored(world, trainer, pokemon, saved.location)
  return pokemon
}

/**
 * `criarPokemon` já pôs o registro na primeira célula livre; aqui ele vai pro
 * lugar salvo, se der.
 */
function placeRestored(world, trainer, pokemon, location) {
  if (location.kind === 'party') {
    const slot = findPartyPokemon(trainer, location.slot)
      ? findFreePartySlot(trainer)
      : location.slot
    if (slot) colocarNoTime(trainer, pokemon, slot)
    return
  }

  const { cell } = location
  if (cell >= resolveInventoryCapacity()) return
  const occupant = resolveInventoryCells(world, trainer).get(cell)
  if (occupant && occupant.pokemon !== pokemon) return
  pokemon.set(InventoryCell, { index: cell })
}
