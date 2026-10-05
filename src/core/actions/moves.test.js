import { beforeEach, describe, expect, it } from 'vitest'
import { makeWorld } from '@/test/makeWorld'
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
  CreatureMoves,
  MoveLearnRequest,
  PartyMoves,
  PartyProgress,
  SummonedCreature,
} from '../traits'
import {
  adiarAprendizado,
  aprenderGolpe,
  ganharDominio,
  pedirAprendizado,
  progredirTreino,
  reordenarGolpes,
} from './moves'
import { equiparCriatura } from './party'

const SLOT = 'slot1'

let world
let player
let events
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
    CreatureMoves(player.get(PartyMoves)[SLOT]),
  )
}

function drainTypes() {
  return events.drain().map((event) => event.type)
}

function trainToCompletion() {
  progredirTreino(world, events, player, SLOT, newMoveId, 1)
}

beforeEach(() => {
  ;({ world, player } = makeWorld())
  events = createEventQueue()
  if (!found) return
  ;({ speciesId, moveId: newMoveId } = found)
  equiparCriatura(player, SLOT, speciesId)
  // Nível máximo: toda condição de nível cumprida.
  player.set(PartyProgress, {
    [SLOT]: createLevelState(
      getSpecies(speciesId),
      GAME_CONFIG.EXPERIENCE.MAX_LEVEL,
    ),
  })
})

describe.skipIf(!found)('golpes da criatura do time', () => {
  it('equipar dá o kit da espécie', () => {
    expect(player.get(PartyMoves)[SLOT]).toEqual(
      createMovesState(getSpecies(speciesId)),
    )
  })

  it('treinar soma progresso, sem aprender antes de completar', () => {
    const progress = progredirTreino(
      world,
      events,
      player,
      SLOT,
      newMoveId,
      0.25,
    )
    expect(progress).toBeCloseTo(0.25)
    expect(findMoveSlot(player.get(PartyMoves)[SLOT], newMoveId)).toBeNull()
  })

  it('golpe que ainda não cumpre a condição não treina', () => {
    const entry = listLearnset(getSpecies(speciesId)).find(
      (item) => item.id === newMoveId,
    )
    if (!entry.requires?.level) return
    player.set(PartyProgress, {
      [SLOT]: createLevelState(getSpecies(speciesId), entry.requires.level - 1),
    })
    expect(
      progredirTreino(world, events, player, SLOT, newMoveId, 1),
    ).toBeNull()
  })

  it('com slot vazio, completar o treino aprende direto com domínio inicial', () => {
    const state = createMovesState(getSpecies(speciesId))
    state.slots[3] = null
    player.set(PartyMoves, { [SLOT]: state })

    trainToCompletion()

    const after = player.get(PartyMoves)[SLOT]
    expect(after.slots[3]).toEqual({
      id: newMoveId,
      mastery: GAME_CONFIG.MOVES.MASTERY.INITIAL,
    })
    expect(after.training[newMoveId]).toBeUndefined()
    expect(drainTypes()).toContain(EVENT_TYPES.MOVE_LEARNED)
  })

  it('com os 3 ocupados, completar o treino pede "esquecer qual?"', () => {
    trainToCompletion()
    expect(player.get(MoveLearnRequest)).toEqual({
      slot: SLOT,
      moveId: newMoveId,
    })
    expect(drainTypes()).toContain(EVENT_TYPES.MOVE_READY_TO_LEARN)
  })

  it('aprender esquece o golpe do slot, que guarda parte do treino', () => {
    trainToCompletion()
    const forgottenId = player.get(PartyMoves)[SLOT].slots[1].id

    expect(aprenderGolpe(world, events, player, SLOT, newMoveId, 1)).toBe(true)

    const after = player.get(PartyMoves)[SLOT]
    expect(after.slots[1].id).toBe(newMoveId)
    expect(findMoveSlot(after, forgottenId)).toBeNull()
    expect(after.training[forgottenId]).toBe(
      GAME_CONFIG.MOVES.TRAINING.FORGET_RETAINED,
    )
    expect(player.get(MoveLearnRequest).moveId).toBeNull()
  })

  it('N repetições de 1/N completam o treino (sem sobra de arredondamento)', () => {
    const repetitions = 7
    for (let i = 0; i < repetitions; i++) {
      progredirTreino(world, events, player, SLOT, newMoveId, 1 / repetitions)
    }
    expect(player.get(MoveLearnRequest).moveId).toBe(newMoveId)
  })

  it('não aprende sem o treino completo', () => {
    progredirTreino(world, events, player, SLOT, newMoveId, 0.5)
    expect(aprenderGolpe(world, events, player, SLOT, newMoveId, 1)).toBe(false)
  })

  it('adiar mantém o treino completo, e dá pra pedir de novo', () => {
    trainToCompletion()
    adiarAprendizado(player)
    expect(player.get(MoveLearnRequest).moveId).toBeNull()
    expect(player.get(PartyMoves)[SLOT].training[newMoveId]).toBe(1)

    expect(pedirAprendizado(player, SLOT, newMoveId)).toBe(true)
    expect(player.get(MoveLearnRequest).moveId).toBe(newMoveId)
  })

  it('a criatura em campo recebe uma cópia do mesmo estado', () => {
    const creature = spawnSummoned()
    trainToCompletion()
    aprenderGolpe(world, events, player, SLOT, newMoveId, 2)

    const party = player.get(PartyMoves)[SLOT]
    const field = creature.get(CreatureMoves)
    expect(field).toEqual(party)
    expect(field).not.toBe(party)
  })

  it('reordenar troca dois slots de lugar', () => {
    const before = player.get(PartyMoves)[SLOT]
    const [a, b] = MOVE_SLOTS
    reordenarGolpes(world, player, SLOT, a, b)
    const after = player.get(PartyMoves)[SLOT]
    expect(after.slots[a]).toEqual(before.slots[b])
    expect(after.slots[b]).toEqual(before.slots[a])
  })

  it('domínio sobe com o uso só no golpe equipado e para no máximo', () => {
    trainToCompletion()
    aprenderGolpe(world, events, player, SLOT, newMoveId, 1)

    ganharDominio(world, player, SLOT, newMoveId, true)
    const mastery = player.get(PartyMoves)[SLOT].slots[1].mastery
    expect(mastery).toBeGreaterThan(GAME_CONFIG.MOVES.MASTERY.INITIAL)

    for (let use = 0; use < 10000; use++) {
      ganharDominio(world, player, SLOT, newMoveId, false)
    }
    expect(player.get(PartyMoves)[SLOT].slots[1].mastery).toBe(MAX_MASTERY)
  })
})
