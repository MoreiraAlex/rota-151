import { beforeEach, describe, expect, it } from 'vitest'
import { givePokemon, makeWorld, ownedByPlayer } from '@/test/makeWorld'
import { getSpecies } from '../data/species'
import { createLevelState } from '../data/species/experience'
import {
  MAX_MASTERY,
  MOVE_SLOTS,
  createMovesState,
  findMoveSlot,
  listLearnset,
} from '../data/species/moves'
import { EVENT_TYPES, createEventQueue } from '../events'
import { GAME_CONFIG } from '../gameConfig'
import {
  CreatureLevel,
  CreatureMoves,
  SummonedCreature,
  SummonedFrom,
} from '../traits'
import {
  adiarAprendizado,
  aprenderGolpe,
  ganharDominio,
  pedirAprendizado,
  progredirTreino,
  resolveMoveLearnRequest,
  reordenarGolpes,
} from './moves'

const SLOT = 'slot1'

let world
let player
let events
// Registro do Pokémon testado (no slot `SLOT`).
let pokemon
let speciesId
let newMoveId

// Uma espécie com algum golpe no learnset fora do kit — o conteúdo é do
// usuário, então o teste acha um em vez de fixar.
function findSpeciesWithNewMove() {
  for (const id of ['charmander', 'bulbasaur', 'squirtle']) {
    const species = getSpecies(id)
    const kit = createMovesState(species)
    const entry = listLearnset(species).find(
      (item) => findMoveSlot(kit, item.id) == null,
    )
    if (entry) return { speciesId: id, moveId: entry.id }
  }
  return null
}

const found = findSpeciesWithNewMove()

function spawnSummoned() {
  return world.spawn(
    SummonedCreature({ slot: SLOT, speciesId }),
    ...ownedByPlayer(world),
    SummonedFrom(pokemon),
    CreatureMoves(pokemon.get(CreatureMoves)),
  )
}

function drainTypes() {
  return events.drain().map((event) => event.type)
}

function trainToCompletion() {
  progredirTreino(world, events, pokemon, newMoveId, 1)
}

beforeEach(() => {
  ;({ world, player } = makeWorld())
  events = createEventQueue()
  if (!found) return
  ;({ speciesId, moveId: newMoveId } = found)
  pokemon = givePokemon(world, player, speciesId, SLOT)
  // Nível máximo: toda condição de nível cumprida.
  pokemon.set(
    CreatureLevel,
    createLevelState(getSpecies(speciesId), GAME_CONFIG.EXPERIENCE.MAX_LEVEL),
  )
})

describe.skipIf(!found)('golpes da criatura do time', () => {
  it('o Pokémon novo tem o kit da espécie', () => {
    expect(pokemon.get(CreatureMoves)).toEqual(
      createMovesState(getSpecies(speciesId)),
    )
  })

  it('treinar soma progresso, sem aprender antes de completar', () => {
    const progress = progredirTreino(world, events, pokemon, newMoveId, 0.25)
    expect(progress).toBeCloseTo(0.25)
    expect(findMoveSlot(pokemon.get(CreatureMoves), newMoveId)).toBeNull()
  })

  it('golpe que ainda não cumpre a condição não treina', () => {
    const entry = listLearnset(getSpecies(speciesId)).find(
      (item) => item.id === newMoveId,
    )
    if (!entry.requires?.level) return
    pokemon.set(
      CreatureLevel,
      createLevelState(getSpecies(speciesId), entry.requires.level - 1),
    )
    expect(progredirTreino(world, events, pokemon, newMoveId, 1)).toBeNull()
  })

  it('com slot vazio, completar o treino aprende direto com domínio inicial', () => {
    const state = createMovesState(getSpecies(speciesId))
    state.slots[3] = null
    pokemon.set(CreatureMoves, state)

    trainToCompletion()

    const after = pokemon.get(CreatureMoves)
    expect(after.slots[3]).toEqual({
      id: newMoveId,
      mastery: GAME_CONFIG.MOVES.MASTERY.INITIAL,
    })
    expect(after.training[newMoveId]).toBeUndefined()
    expect(drainTypes()).toContain(EVENT_TYPES.MOVE_LEARNED)
  })

  it('com os 3 ocupados, completar o treino pede "esquecer qual?"', () => {
    trainToCompletion()
    expect(resolveMoveLearnRequest(player)).toEqual({
      pokemon,
      moveId: newMoveId,
    })
    expect(drainTypes()).toContain(EVENT_TYPES.MOVE_READY_TO_LEARN)
  })

  it('aprender esquece o golpe do slot, que guarda parte do treino', () => {
    trainToCompletion()
    const forgottenId = pokemon.get(CreatureMoves).slots[1].id

    expect(aprenderGolpe(world, events, pokemon, newMoveId, 1)).toBe(true)

    const after = pokemon.get(CreatureMoves)
    expect(after.slots[1].id).toBe(newMoveId)
    expect(findMoveSlot(after, forgottenId)).toBeNull()
    expect(after.training[forgottenId]).toBe(
      GAME_CONFIG.MOVES.TRAINING.FORGET_RETAINED,
    )
    expect(resolveMoveLearnRequest(player)).toBeNull()
  })

  it('N repetições de 1/N completam o treino (sem sobra de arredondamento)', () => {
    const repetitions = 7
    for (let i = 0; i < repetitions; i++) {
      progredirTreino(world, events, pokemon, newMoveId, 1 / repetitions)
    }
    expect(resolveMoveLearnRequest(player)?.moveId).toBe(newMoveId)
  })

  it('não aprende sem o treino completo', () => {
    progredirTreino(world, events, pokemon, newMoveId, 0.5)
    expect(aprenderGolpe(world, events, pokemon, newMoveId, 1)).toBe(false)
  })

  it('adiar mantém o treino completo, e dá pra pedir de novo', () => {
    trainToCompletion()
    adiarAprendizado(pokemon)
    expect(resolveMoveLearnRequest(player)).toBeNull()
    expect(pokemon.get(CreatureMoves).training[newMoveId]).toBe(1)

    expect(pedirAprendizado(pokemon, newMoveId)).toBe(true)
    expect(resolveMoveLearnRequest(player)?.moveId).toBe(newMoveId)
  })

  it('a criatura em campo recebe uma cópia do mesmo estado', () => {
    const creature = spawnSummoned()
    trainToCompletion()
    aprenderGolpe(world, events, pokemon, newMoveId, 2)

    const stored = pokemon.get(CreatureMoves)
    const field = creature.get(CreatureMoves)
    expect(field).toEqual(stored)
    expect(field).not.toBe(stored)
  })

  it('reordenar troca dois slots de lugar', () => {
    const before = pokemon.get(CreatureMoves)
    const [a, b] = MOVE_SLOTS
    reordenarGolpes(world, pokemon, a, b)
    const after = pokemon.get(CreatureMoves)
    expect(after.slots[a]).toEqual(before.slots[b])
    expect(after.slots[b]).toEqual(before.slots[a])
  })

  it('domínio sobe com o uso só no golpe equipado e para no máximo', () => {
    trainToCompletion()
    aprenderGolpe(world, events, pokemon, newMoveId, 1)

    ganharDominio(world, pokemon, newMoveId, true)
    const mastery = pokemon.get(CreatureMoves).slots[1].mastery
    expect(mastery).toBeGreaterThan(GAME_CONFIG.MOVES.MASTERY.INITIAL)

    for (let use = 0; use < 10000; use++) {
      ganharDominio(world, pokemon, newMoveId, false)
    }
    expect(pokemon.get(CreatureMoves).slots[1].mastery).toBe(MAX_MASTERY)
  })
})
