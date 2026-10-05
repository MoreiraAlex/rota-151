import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { makeWorld } from '@/test/makeWorld'
import { getSpecies } from '../data/species'
import { createLevelState } from '../data/species/experience'
import {
  cloneMovesState,
  createMovesState,
  findMoveSlot,
  listLearnset,
  resolveSpeciesMoveReference,
} from '../data/species/moves'
import { resolveSkill } from '../data/skills'
import { resolveTrainingHours } from '../battle/actionCost'
import { attackResolved, createEventQueue } from '../events'
import { GAME_CONFIG } from '../gameConfig'
import {
  ActionState,
  AttackCooldowns,
  CharacterController,
  CombatMode,
  CreatureLevel,
  CreatureMoves,
  IndividualValues,
  InputControlled,
  MovementStats,
  PartyBehavior,
  PartyMoves,
  PartyProgress,
  PhysicsBody,
  Position,
  Rotation,
  SummonedCreature,
  Training,
  TrainingObject,
  Velocity,
  Vitals,
  WildCreature,
  vitalsFromSpecies,
} from '../traits'
import { equiparCriatura } from '../actions/party'
import { iniciarTreino, resolveTrainingBlock } from '../actions/training'
import { creatureAttackSystem } from './creatureAttackSystem'
import { trainingSystem } from './trainingSystem'
import { partyReactionSystem } from './partyReactionSystem'

const SLOT = 'slot1'
const DELTA = 1 / 60

let world
let player
let events

// Espécie com golpe no learnset fora do kit (conteúdo do usuário: acha um).
function findTrainable() {
  for (const speciesId of ['charmander', 'bulbasaur', 'squirtle']) {
    const species = getSpecies(speciesId)
    const kit = createMovesState(species)
    const entry = listLearnset(species).find(
      (item) => findMoveSlot(kit, item.id) == null,
    )
    if (entry) return { speciesId, moveId: entry.id }
  }
  return null
}

const found = findTrainable()

function spawnCreature(speciesId, position = { x: 0, y: 1, z: 0 }) {
  const species = getSpecies(speciesId)
  const progress = player.get(PartyProgress)[SLOT]
  return world.spawn(
    Position(position),
    Rotation,
    Velocity,
    MovementStats(species.movement),
    ActionState,
    AttackCooldowns,
    CharacterController(species.body),
    PhysicsBody,
    vitalsFromSpecies(species, null, progress.level),
    SummonedCreature({ slot: SLOT, speciesId }),
    IndividualValues({}),
    CreatureLevel(progress),
    CreatureMoves(cloneMovesState(player.get(PartyMoves)[SLOT])),
    PartyBehavior,
  )
}

function spawnObject(position = { x: 2, y: 0.5, z: 0 }) {
  return world.spawn(
    Position(position),
    TrainingObject({ id: 'test', kind: 'log', radius: 0.4 }),
  )
}

function step() {
  trainingSystem({ world, delta: DELTA, events })
  creatureAttackSystem({
    world,
    delta: DELTA,
    input: {},
    events,
    settings: { castModeOverride: 'instant' },
  })
  events.drain()
}

function withTimeMultiplier(value, run) {
  const original = GAME_CONFIG.MOVES.TRAINING.TIME_MULTIPLIER
  GAME_CONFIG.MOVES.TRAINING.TIME_MULTIPLIER = value
  try {
    run()
  } finally {
    GAME_CONFIG.MOVES.TRAINING.TIME_MULTIPLIER = original
  }
}

function progressOf(moveId) {
  return player.get(PartyMoves)[SLOT].training[moveId] ?? 0
}

beforeEach(() => {
  ;({ world, player } = makeWorld())
  events = createEventQueue()
  if (!found) return
  equiparCriatura(player, SLOT, found.speciesId)
  player.set(PartyProgress, {
    [SLOT]: createLevelState(
      getSpecies(found.speciesId),
      GAME_CONFIG.EXPERIENCE.MAX_LEVEL,
    ),
  })
})

afterEach(() => world?.destroy())

describe.skipIf(!found)('treino de golpe', () => {
  it('o progresso de uma repetição é o tempo dela sobre as horas do golpe', () => {
    spawnCreature(found.speciesId)
    spawnObject()
    iniciarTreino(world, player, SLOT, found.moveId)

    let ticks = 0
    while (progressOf(found.moveId) === 0 && ticks < 60 * 30) {
      step()
      ticks++
    }

    const attack = resolveSkill(
      resolveSpeciesMoveReference(getSpecies(found.speciesId), found.moveId),
    )
    const learnSeconds = resolveTrainingHours(attack).learn * 3600
    // Nunca mais que o tempo desde o começo (andar até o objeto não conta).
    expect(progressOf(found.moveId)).toBeGreaterThan(0)
    expect(progressOf(found.moveId)).toBeLessThanOrEqual(
      (ticks * DELTA) / learnSeconds + 1e-12,
    )
  })

  it('golpe equipado sem domínio total: o treino sobe o domínio', () => {
    const state = cloneMovesState(player.get(PartyMoves)[SLOT])
    const equippedId = state.slots[1].id
    state.slots[1].mastery = 0.5
    player.set(PartyMoves, { [SLOT]: state })
    const creature = spawnCreature(found.speciesId)
    spawnObject()
    expect(iniciarTreino(world, player, SLOT, equippedId)).toBe(true)

    withTimeMultiplier(1e3, () => {
      for (let i = 0; i < 60 * 20 && creature.has(Training); i++) {
        step()
        if (player.get(PartyMoves)[SLOT].slots[1].mastery > 0.5) break
      }
    })

    expect(player.get(PartyMoves)[SLOT].slots[1].mastery).toBeGreaterThan(0.5)
  })

  it('golpe já dominado não tem o que treinar', () => {
    spawnCreature(found.speciesId)
    spawnObject()
    const dominated = player.get(PartyMoves)[SLOT].slots[1].id
    expect(iniciarTreino(world, player, SLOT, dominated)).toBe(false)
  })

  it('sem objeto de treino perto, não começa', () => {
    spawnCreature(found.speciesId)
    expect(resolveTrainingBlock(world, SLOT)).toBe('no-object')
    expect(iniciarTreino(world, player, SLOT, found.moveId)).toBe(false)
  })

  it('sem a criatura invocada, não começa', () => {
    spawnObject()
    expect(resolveTrainingBlock(world, SLOT)).toBe('not-summoned')
  })

  it('perto do objeto, repete o golpe e o treino progride', () => {
    const creature = spawnCreature(found.speciesId)
    spawnObject()
    expect(iniciarTreino(world, player, SLOT, found.moveId)).toBe(true)

    for (let i = 0; i < 60 * 20 && progressOf(found.moveId) === 0; i++) step()

    expect(progressOf(found.moveId)).toBeGreaterThan(0)
    // treino não é luta
    expect(creature.has(CombatMode)).toBe(false)
  })

  it('sem energia pra repetir, descansa em vez de repetir', () => {
    const creature = spawnCreature(found.speciesId)
    spawnObject()
    iniciarTreino(world, player, SLOT, found.moveId)
    creature.set(Vitals, { stamina: 0 })

    for (let i = 0; i < 10; i++) step()

    expect(creature.get(Training).resting).toBe(true)
    expect(creature.get(Training).waiting).toBe(true)
    expect(creature.get(ActionState).current).toBeNull()
  })

  it('assumir o controle no meio de uma repetição para o treino e o golpe', () => {
    const creature = spawnCreature(found.speciesId)
    spawnObject()
    iniciarTreino(world, player, SLOT, found.moveId)
    for (let i = 0; i < 60 * 5; i++) {
      step()
      if (creature.get(ActionState).current === 'attack') break
    }
    expect(creature.get(ActionState).current).toBe('attack')

    creature.add(InputControlled)
    expect(() => step()).not.toThrow()

    expect(creature.has(Training)).toBe(false)
    expect(creature.get(ActionState).current).toBeNull()
  })

  it('no meio de uma repetição não está esperando; depois dela, sim', () => {
    const creature = spawnCreature(found.speciesId)
    spawnObject()
    iniciarTreino(world, player, SLOT, found.moveId)
    for (let i = 0; i < 60 * 5; i++) {
      step()
      if (creature.get(ActionState).current === 'attack') break
    }
    expect(creature.get(Training).waiting).toBe(false)

    for (let i = 0; i < 60 * 5; i++) {
      step()
      if (creature.get(ActionState).current === null) break
    }
    step()
    expect(creature.get(Training).waiting).toBe(true)
  })

  it('o time entrar numa luta não tira ela do treino', () => {
    const creature = spawnCreature(found.speciesId)
    spawnObject()
    iniciarTreino(world, player, SLOT, found.moveId)
    creature.add(CombatMode({ timeLeft: 5 }))
    creature.set(PartyBehavior, { state: 'fight' })

    step()

    expect(creature.has(Training)).toBe(true)
  })

  it('o treinador se afastar não tira ela do treino; longe do objeto, ela volta', () => {
    const creature = spawnCreature(found.speciesId)
    const object = spawnObject()
    iniciarTreino(world, player, SLOT, found.moveId)
    player.set(Position, { x: 500, y: 2, z: 500 })
    creature.set(Position, { x: 50, y: 1, z: 0 })

    step()

    expect(creature.has(Training)).toBe(true)
    // anda na direção do objeto (que está em x menor)
    expect(creature.get(Velocity).x).toBeLessThan(0)
    expect(object.isAlive()).toBe(true)
  })

  it('ser atacada tira do treino (mesmo um golpe que errou)', () => {
    const creature = spawnCreature(found.speciesId)
    spawnObject()
    iniciarTreino(world, player, SLOT, found.moveId)
    const wild = world.spawn(WildCreature({ speciesId: found.speciesId }))
    const reactionEvents = createEventQueue()
    reactionEvents.emit(
      attackResolved({
        attacker: wild,
        target: creature,
        attackId: 'tackle',
        slot: 'primary',
        origin: { x: 0, y: 0, z: 0 },
        impactPoint: { x: 0, y: 0, z: 0 },
        missed: true,
      }),
    )

    partyReactionSystem({ world, events: reactionEvents })

    expect(creature.has(Training)).toBe(false)
  })

  it('outra criatura do time ser atacada não tira esta do treino', () => {
    const creature = spawnCreature(found.speciesId)
    spawnObject()
    iniciarTreino(world, player, SLOT, found.moveId)
    const wild = world.spawn(
      Position({ x: 3, y: 1, z: 0 }),
      vitalsFromSpecies(getSpecies(found.speciesId)),
      WildCreature({ speciesId: found.speciesId }),
    )
    const reactionEvents = createEventQueue()
    reactionEvents.emit(
      attackResolved({
        attacker: wild,
        target: player,
        attackId: 'tackle',
        slot: 'primary',
        origin: { x: 0, y: 0, z: 0 },
        impactPoint: { x: 0, y: 0, z: 0 },
        damage: 1,
      }),
    )

    partyReactionSystem({ world, events: reactionEvents })

    expect(creature.has(Training)).toBe(true)
    expect(creature.get(PartyBehavior).state).not.toBe('fight')
  })

  it('treino completo acaba o treino', () => {
    const creature = spawnCreature(found.speciesId)
    spawnObject()
    const state = cloneMovesState(player.get(PartyMoves)[SLOT])
    state.training[found.moveId] = 0.999
    player.set(PartyMoves, { [SLOT]: state })
    iniciarTreino(world, player, SLOT, found.moveId)

    // Relógio acelerado: uma repetição basta (o tempo de verdade é de horas).
    withTimeMultiplier(1e6, () => {
      for (let i = 0; i < 60 * 20 && creature.has(Training); i++) step()
    })

    expect(creature.has(Training)).toBe(false)
    expect(
      progressOf(found.moveId) >= 1 ||
        !!findMoveSlot(player.get(PartyMoves)[SLOT], found.moveId),
    ).toBe(true)
  })
})
