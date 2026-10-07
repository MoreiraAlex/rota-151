import { getSpecies } from '../data/species'
import {
  MAX_MASTERY,
  MOVE_SLOTS,
  cloneMovesState,
  findEmptyMoveSlot,
  findMoveSlot,
  listLearnset,
  meetsMoveRequirements,
} from '../data/species/moves'
import { resolveMasteryAfterUse } from '../battle/moveMastery'
import { moveLearned, moveReadyToLearn, moveUnlocked } from '../events'
import { GAME_CONFIG } from '../gameConfig'
import { CreatureLevel, CreatureMoves, MoveLearnRequest } from '../traits'
import { resolveOwner } from './owner'
import { findSummonedCreature, resolvePokemonSpeciesId } from './pokemon'

/**
 * Golpes de um Pokémon do treinador (docs/features/038-aprendizado-treino-e-
 * dominio-de-golpes.md). Toda mutação dos golpes do registro (`Pokemon`,
 * `CreatureMoves`) passa por aqui, e cada action escreve no registro E na
 * criatura em campo (`CreatureMoves`, cópia), como `ganharExperiencia`.
 *
 * - `progredirTreino` — soma progresso de treino; completo, aprende (slot
 *   vazio) ou pede "esquecer qual?" (`MoveLearnRequest`).
 * - `aprenderGolpe` — põe o golpe treinado num slot, esquecendo o que
 *   estava lá (que guarda parte do treino).
 * - `reordenarGolpes` — troca dois slots de lugar.
 * - `ganharDominio` — um uso em combate.
 */

const PROGRESS_EPSILON = 1e-9

function readMoves(pokemon) {
  const state = pokemon?.get?.(CreatureMoves)
  return state ? cloneMovesState(state) : null
}

function writeMoves(world, pokemon, next) {
  pokemon.set(CreatureMoves, cloneMovesState(next))
  const creature = findSummonedCreature(world, pokemon)
  if (creature?.has(CreatureMoves)) {
    creature.set(CreatureMoves, cloneMovesState(next))
  }
  return creature
}

/**
 * O golpe está no learnset do `pokemon` e ele cumpre as condições dele
 * (nível)? Só esses podem ser treinados.
 */
export function podeTreinarGolpe(pokemon, moveId) {
  const species = getSpecies(resolvePokemonSpeciesId(pokemon))
  const entry = listLearnset(species).find((item) => item.id === moveId)
  if (!entry) return false
  return meetsMoveRequirements(entry, {
    level: pokemon.get(CreatureLevel)?.level ?? 1,
  })
}

/**
 * Soma `amount` ao treino de `moveId` no `pokemon` (teto: completo).
 * Ao completar, aprende direto no primeiro slot vazio; com os 3 ocupados,
 * abre o pedido "esquecer qual?" (`MoveLearnRequest`) e emite
 * `moveReadyToLearn`. Golpe que ela já sabe ou não pode treinar não muda
 * nada. Devolve o progresso (ou `null`).
 */
export function progredirTreino(world, events, pokemon, moveId, amount) {
  const state = readMoves(pokemon)
  if (!state || !(amount > 0)) return null
  if (findMoveSlot(state, moveId) != null) return null
  if (!podeTreinarGolpe(pokemon, moveId)) return null

  const previous = state.training[moveId] ?? 0
  // Folga de arredondamento: N repetições de 1/N têm que completar o treino.
  const sum = previous + amount
  const progress = sum >= 1 - PROGRESS_EPSILON ? 1 : sum
  state.training[moveId] = progress
  const creature = writeMoves(world, pokemon, state)

  if (progress < 1 || previous >= 1) return progress

  const emptySlot = findEmptyMoveSlot(state)
  if (emptySlot != null) {
    aprenderGolpe(world, events, pokemon, moveId, emptySlot)
  } else {
    pedirAprendizado(pokemon, moveId)
    const trainer = resolveOwner(pokemon)
    events?.emit(moveReadyToLearn({ trainer, pokemon, creature, moveId }))
  }
  return progress
}

/**
 * Reabre o "esquecer qual?" de um golpe com o treino completo (o treinador
 * tinha adiado). Sem treino completo, não faz nada.
 */
export function pedirAprendizado(pokemon, moveId) {
  const state = pokemon?.get?.(CreatureMoves)
  if ((state?.training?.[moveId] ?? 0) < 1) return false
  const trainer = resolveOwner(pokemon)
  if (!trainer) return false
  if (trainer.has(MoveLearnRequest(pokemon))) {
    trainer.set(MoveLearnRequest(pokemon), { moveId })
  } else {
    trainer.add(MoveLearnRequest(pokemon, { moveId }))
  }
  return true
}

/**
 * O pedido "esquecer qual?" aberto do `trainer`: `{ pokemon, moveId }`, ou
 * `null` sem nenhum.
 */
export function resolveMoveLearnRequest(trainer) {
  const pokemon = trainer?.targetFor?.(MoveLearnRequest)
  if (!pokemon?.isAlive()) return null
  return { pokemon, moveId: trainer.get(MoveLearnRequest(pokemon)).moveId }
}

/**
 * Fecha o "esquecer qual?" do `pokemon` sem aprender: o golpe fica pronto
 * pra depois.
 */
export function adiarAprendizado(pokemon) {
  const trainer = resolveOwner(pokemon)
  if (trainer?.has(MoveLearnRequest(pokemon))) {
    trainer.remove(MoveLearnRequest(pokemon))
  }
}

/**
 * O `pokemon` aprende `moveId` (treino completo) no slot de golpe
 * `moveSlot`. O golpe que estava lá é ESQUECIDO e volta a apto guardando
 * `FORGET_RETAINED` do treino (ou o que já tinha, se for mais). O novo entra
 * com o domínio inicial. Fecha o pedido "esquecer qual?". Devolve se
 * aprendeu.
 */
export function aprenderGolpe(world, events, pokemon, moveId, moveSlot) {
  const state = readMoves(pokemon)
  if (!state || !MOVE_SLOTS.includes(Number(moveSlot))) return false
  if ((state.training[moveId] ?? 0) < 1) return false
  if (findMoveSlot(state, moveId) != null) return false

  const forgotten = state.slots[moveSlot]
  if (forgotten) {
    state.training[forgotten.id] = Math.max(
      state.training[forgotten.id] ?? 0,
      GAME_CONFIG.MOVES.TRAINING.FORGET_RETAINED,
    )
  }
  state.slots[moveSlot] = {
    id: moveId,
    mastery: GAME_CONFIG.MOVES.MASTERY.INITIAL,
  }
  delete state.training[moveId]

  const creature = writeMoves(world, pokemon, state)
  adiarAprendizado(pokemon)
  events?.emit(
    moveLearned({
      trainer: resolveOwner(pokemon),
      pokemon,
      creature,
      moveId,
      forgottenId: forgotten?.id ?? null,
    }),
  )
  return true
}

/** Troca de lugar os golpes dos slots `fromSlot` e `toSlot` (Q/E/R). */
export function reordenarGolpes(world, pokemon, fromSlot, toSlot) {
  const state = readMoves(pokemon)
  if (!state || fromSlot === toSlot) return false
  if (!MOVE_SLOTS.includes(fromSlot) || !MOVE_SLOTS.includes(toSlot)) {
    return false
  }

  const moving = state.slots[fromSlot]
  state.slots[fromSlot] = state.slots[toSlot]
  state.slots[toSlot] = moving
  writeMoves(world, pokemon, state)
  return true
}

/**
 * Um uso em combate do golpe `moveId` (equipado) pelo `pokemon`:
 * o domínio sobe (`resolveMasteryAfterUse`; acerto rende mais). Golpe fora
 * dos slots, ou já dominado, não muda.
 */
export function ganharDominio(world, pokemon, moveId, hit) {
  const state = readMoves(pokemon)
  const moveSlot = state ? findMoveSlot(state, moveId) : null
  if (moveSlot == null) return
  const move = state.slots[moveSlot]
  if (move.mastery >= MAX_MASTERY) return

  move.mastery = resolveMasteryAfterUse(move.mastery, hit)
  writeMoves(world, pokemon, state)
}

/**
 * Treino de DOMÍNIO no objeto de treino: soma `amount` (fração do domínio
 * máximo) no golpe `moveId`, que precisa estar equipado. Linear — o retorno
 * decrescente é só do combate. Devolve o domínio novo (ou `null`).
 */
export function treinarDominio(world, pokemon, moveId, amount) {
  const state = readMoves(pokemon)
  const moveSlot = state ? findMoveSlot(state, moveId) : null
  if (moveSlot == null || !(amount > 0)) return null
  const move = state.slots[moveSlot]
  const sum = move.mastery + amount * MAX_MASTERY
  move.mastery = sum >= MAX_MASTERY - PROGRESS_EPSILON ? MAX_MASTERY : sum
  writeMoves(world, pokemon, state)
  return move.mastery
}

/** Debug: soma `amount` de domínio direto no golpe do slot `moveSlot`. */
export function somarDominio(world, pokemon, moveSlot, amount) {
  const state = readMoves(pokemon)
  const move = state?.slots?.[moveSlot]
  if (!move) return
  move.mastery = Math.min(MAX_MASTERY, Math.max(0, move.mastery + amount))
  writeMoves(world, pokemon, state)
}

/**
 * Subiu de `fromLevel` pra `level`: golpes do learnset que passaram a
 * cumprir as condições (e que ela não sabe). Emite `moveUnlocked` se houver.
 */
export function anunciarGolpesAptos(
  events,
  pokemon,
  creature,
  fromLevel,
  level,
) {
  const species = getSpecies(resolvePokemonSpeciesId(pokemon))
  const state = pokemon.get(CreatureMoves)
  const moveIds = listLearnset(species)
    .filter(
      (entry) =>
        findMoveSlot(state, entry.id) == null &&
        !meetsMoveRequirements(entry, { level: fromLevel }) &&
        meetsMoveRequirements(entry, { level }),
    )
    .map((entry) => entry.id)
  if (moveIds.length) {
    events?.emit(
      moveUnlocked({
        trainer: resolveOwner(pokemon),
        pokemon,
        creature,
        moveIds,
      }),
    )
  }
  return moveIds
}
