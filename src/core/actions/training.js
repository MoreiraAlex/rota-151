import { GAME_CONFIG } from '../gameConfig'
import { MAX_MASTERY, findMoveSlot } from '../data/species/moves'
import { finishAttack } from '../battle/attackCasting'
import { TRAINING_SLOT } from '../battle/creatureAttack'
import {
  ActionState,
  CombatMode,
  Fainted,
  InputControlled,
  PartyBehavior,
  PartyMoves,
  Position,
  Training,
  TrainingObject,
  Velocity,
} from '../traits'
import { findSummonedCreature } from './experience'
import { podeTreinarGolpe } from './moves'

/**
 * Treino de golpe (docs/features/038-aprendizado-treino-e-dominio-de-
 * golpes.md): a criatura do time, invocada e fora de combate, perto de um
 * objeto de treino, repete o golpe sozinha até aprender (`trainingSystem.js`).
 */

/** O objeto de treino mais perto de `pos`, até `TRAINING.START_RADIUS` (ou `null`). */
export function findNearbyTrainingObject(world, pos) {
  const { START_RADIUS } = GAME_CONFIG.MOVES.TRAINING
  let nearest = null
  let nearestDistance = Infinity
  world
    .query(TrainingObject, Position)
    .readEach(([object, objectPos], entity) => {
      const distance =
        Math.hypot(objectPos.x - pos.x, objectPos.z - pos.z) - object.radius
      if (distance <= START_RADIUS && distance < nearestDistance) {
        nearest = entity
        nearestDistance = distance
      }
    })
  return nearest
}

/** A criatura está em luta (modo combate ou defendendo o grupo)? */
export function isFighting(creature) {
  return (
    creature.has(CombatMode) || creature.get(PartyBehavior)?.state === 'fight'
  )
}

/**
 * Por que a criatura do `slot` não pode treinar AGORA (independe do golpe):
 * `'not-summoned'` | `'fainted'` | `'controlled'` | `'in-combat'` |
 * `'no-object'` — ou `null`, se pode.
 */
export function resolveTrainingBlock(world, slot) {
  const creature = findSummonedCreature(world, slot)
  if (!creature) return 'not-summoned'
  if (creature.has(Fainted)) return 'fainted'
  if (creature.has(InputControlled)) return 'controlled'
  if (isFighting(creature)) return 'in-combat'
  if (!findNearbyTrainingObject(world, creature.get(Position))) {
    return 'no-object'
  }
  return null
}

/**
 * O que treinar `moveId` faz agora na criatura do `slot`: `'learn'` (apto, treino
 * ainda incompleto), `'master'` (equipado e ainda não dominado) ou `null`
 * (nada a treinar).
 */
export function resolveTrainingGoal(trainer, slot, moveId) {
  const state = trainer.get(PartyMoves)?.[slot]
  if (!state) return null
  const moveSlot = findMoveSlot(state, moveId)
  if (moveSlot != null) {
    return state.slots[moveSlot].mastery < MAX_MASTERY ? 'master' : null
  }
  if (!podeTreinarGolpe(trainer, slot, moveId)) return null
  return (state.training?.[moveId] ?? 0) < 1 ? 'learn' : null
}

/**
 * Começa a treinar `moveId` na criatura do `slot` (troca o treino atual, se
 * houver) — pra APRENDER (golpe apto) ou pra DOMINAR (golpe equipado sem
 * domínio total), ver `resolveTrainingGoal`. Só se ela pode treinar agora
 * (`resolveTrainingBlock`). Devolve se começou.
 */
export function iniciarTreino(world, trainer, slot, moveId) {
  if (resolveTrainingBlock(world, slot)) return false
  if (!resolveTrainingGoal(trainer, slot, moveId)) return false

  const creature = findSummonedCreature(world, slot)
  const object = findNearbyTrainingObject(world, creature.get(Position))
  const training = { moveId, object, wait: 0, resting: false, elapsed: 0 }
  if (creature.has(Training)) creature.set(Training, training)
  else creature.add(Training(training))
  return true
}

/**
 * Para o treino da criatura (ela volta a seguir o treinador). Uma repetição
 * em andamento acaba junto: sem o `Training`, o slot interno de treino não
 * resolve mais golpe nenhum.
 */
export function pararTreino(creature) {
  if (!creature?.isAlive?.() || !creature.has(Training)) return
  const action = creature.has(ActionState) ? creature.get(ActionState) : null
  if (action?.current === 'attack' && action.pendingSlot === TRAINING_SLOT) {
    finishAttack(creature, action, { cooldown: 0 })
    creature.set(ActionState, action)
  }
  creature.remove(Training)
  if (creature.has(Velocity)) {
    creature.set(Velocity, { ...creature.get(Velocity), x: 0, z: 0 })
  }
}

/** A criatura do `slot` está treinando? Devolve o id do golpe (ou `null`). */
export function resolveTrainingMove(world, slot) {
  const creature = findSummonedCreature(world, slot)
  return creature?.has(Training) ? creature.get(Training).moveId : null
}
