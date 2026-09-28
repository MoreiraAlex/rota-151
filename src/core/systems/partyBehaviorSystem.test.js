import { afterEach, describe, expect, it } from 'vitest'
import { makeWorld } from '@/test/makeWorld'
import { desmaiar } from '../actions/faint'
import { defenderGrupo } from '../actions/partyBehavior'
import { perseguirJogador } from '../actions/wildBehavior'
import { resolveCreatureAttack } from '../data/attacks'
import { getSpecies } from '../data/species'
import { attackResolved, createEventQueue } from '../events'
import { GAME_CONFIG } from '../gameConfig'
import {
  ActionState,
  AttackCooldowns,
  CharacterController,
  IndividualValues,
  InputControlled,
  Mood,
  MovementStats,
  PartyBehavior,
  PathState,
  PhysicsBody,
  Position,
  Rotation,
  SummonedCreature,
  Velocity,
  Vitals,
  WantsToAttack,
  WanderState,
  WildBehavior,
  WildCreature,
  vitalsFromSpecies,
} from '../traits'
import { creatureAttackSystem } from './creatureAttackSystem'
import { creatureFollowSystem } from './creatureFollowSystem'
import { partyBehaviorSystem } from './partyBehaviorSystem'
import { partyReactionSystem } from './partyReactionSystem'
import { wildBehaviorSystem } from './wildBehaviorSystem'
import { wildReactionSystem } from './wildReactionSystem'

const DELTA = 1 / 60
const { ATTACK_INTERVAL, LEASH_RADIUS } = GAME_CONFIG.PARTY_BEHAVIOR
const CHARMANDER = getSpecies('charmander')
// Longe dos obstáculos do nível de teste.
const BASE = { x: 30, y: 0.45, z: 30 }

const worlds = []
afterEach(() => {
  while (worlds.length) worlds.pop().destroy()
})

function at(dx, dz) {
  return { x: BASE.x + dx, y: BASE.y, z: BASE.z + dz }
}

/** Criatura do time como o `summonBallSystem` cria (fora do controle). */
function spawnPartyCreature(world, position, slot = 'slot1') {
  return world.spawn(
    SummonedCreature({ slot, speciesId: 'charmander' }),
    PartyBehavior,
    Position(position),
    Rotation,
    Velocity,
    MovementStats(CHARMANDER.movement),
    CharacterController(CHARMANDER.body),
    PhysicsBody,
    PathState,
    ActionState,
    AttackCooldowns,
    IndividualValues,
    Mood,
    vitalsFromSpecies(CHARMANDER),
  )
}

function spawnWild(world, position) {
  return world.spawn(
    WildCreature({ speciesId: 'charmander' }),
    WildBehavior({ temperament: 'hostile' }),
    Position(position),
    Rotation,
    Velocity,
    MovementStats(CHARMANDER.movement),
    CharacterController(CHARMANDER.body),
    PhysicsBody,
    PathState,
    WanderState({ homeX: position.x, homeZ: position.z }),
    ActionState,
    AttackCooldowns,
    IndividualValues,
    Mood,
    vitalsFromSpecies(CHARMANDER),
  )
}

function setup() {
  const { world, player } = makeWorld({ playerPosition: at(0, 0) })
  worlds.push(world)
  return { world, trainer: player }
}

function react(world, events) {
  const queue = createEventQueue()
  queue.beginStep()
  for (const event of events) queue.emit(event)
  partyReactionSystem({ world, events: queue })
}

function hit(attacker, target) {
  return attackResolved({
    attacker,
    target,
    attackId: 'scratch',
    slot: 'primary',
    origin: { x: 0, y: 0, z: 0 },
    impactPoint: { x: 0, y: 0, z: 1 },
    damage: 5,
  })
}

const stateOf = (entity) => entity.get(PartyBehavior)

describe('partyReactionSystem — sempre defensiva', () => {
  it('selvagem acerta o treinador: a criatura do time entra na luta contra ela', () => {
    const { world, trainer } = setup()
    const mine = spawnPartyCreature(world, at(-2, 0))
    const wild = spawnWild(world, at(2, 0))

    react(world, [hit(wild, trainer)])

    expect(stateOf(mine)).toMatchObject({ state: 'fight', target: wild })
  })

  it('selvagem acerta outra criatura do time: as outras também defendem', () => {
    const { world } = setup()
    const hurt = spawnPartyCreature(world, at(-2, 0), 'slot1')
    const other = spawnPartyCreature(world, at(-3, 0), 'slot2')
    const wild = spawnWild(world, at(2, 0))

    react(world, [hit(wild, hurt)])

    expect(stateOf(hurt)).toMatchObject({ state: 'fight', target: wild })
    expect(stateOf(other)).toMatchObject({ state: 'fight', target: wild })
  })

  it('golpe do lado do jogador numa selvagem não põe ninguém na luta (só defende)', () => {
    const { world, trainer } = setup()
    const mine = spawnPartyCreature(world, at(-2, 0))
    const wild = spawnWild(world, at(2, 0))

    react(world, [hit(trainer, wild)])

    expect(stateOf(mine).state).toBe('follow')
  })

  it('só selvagem conta como agressora (golpe de alguém do grupo num aliado não vira luta)', () => {
    const { world, trainer } = setup()
    const mine = spawnPartyCreature(world, at(-2, 0), 'slot1')
    const other = spawnPartyCreature(world, at(-3, 0), 'slot2')

    react(world, [hit(other, trainer)])

    expect(stateOf(mine).state).toBe('follow')
  })

  it('a controlada e a desmaiada não entram na luta', () => {
    const { world, trainer } = setup()
    const controlled = spawnPartyCreature(world, at(-2, 0), 'slot1')
    trainer.remove(InputControlled)
    controlled.add(InputControlled)
    const fainted = spawnPartyCreature(world, at(-3, 0), 'slot2')
    desmaiar(world, fainted)
    const wild = spawnWild(world, at(2, 0))

    react(world, [hit(wild, trainer)])

    expect(stateOf(controlled).state).toBe('follow')
    expect(stateOf(fainted).state).toBe('follow')
  })

  it('quem já está lutando mantém o alvo', () => {
    const { world, trainer } = setup()
    const mine = spawnPartyCreature(world, at(-2, 0))
    const first = spawnWild(world, at(2, 0))
    const second = spawnWild(world, at(4, 0))
    defenderGrupo(mine, first)

    react(world, [hit(second, trainer)])

    expect(stateOf(mine).target).toBe(first)
  })
})

describe('partyBehaviorSystem — lutando', () => {
  const scratch = resolveCreatureAttack(CHARMANDER.attacks.primary)
  const REACH = scratch.range + scratch.radius + CHARMANDER.body.capsuleRadius

  function tick(world) {
    partyBehaviorSystem({ world, delta: DELTA })
    creatureFollowSystem({ world, delta: DELTA })
  }

  it('longe do alvo, corre até ele (o follow não puxa de volta pro treinador)', () => {
    const { world } = setup()
    const mine = spawnPartyCreature(world, at(0, 3))
    const wild = spawnWild(world, at(0, 8)) // em +Z
    defenderGrupo(mine, wild)

    for (let i = 0; i < 30; i++) tick(world)

    const vel = mine.get(Velocity)
    expect(vel.z).toBeGreaterThan(0) // rumo à selvagem, não ao treinador (-Z)
    expect(Math.hypot(vel.x, vel.z)).toBeCloseTo(CHARMANDER.movement.runSpeed)
  })

  it('ao alcance, pede golpe na selvagem e respeita o intervalo (mais lento que o jogador)', () => {
    const { world } = setup()
    const mine = spawnPartyCreature(world, at(0, 3))
    const wild = spawnWild(world, at(0, 3 + REACH - 0.2))
    defenderGrupo(mine, wild)

    tick(world)
    expect(mine.get(WantsToAttack)?.target).toBe(wild)

    mine.remove(WantsToAttack) // o creatureAttackSystem consome
    tick(world)
    expect(mine.has(WantsToAttack)).toBe(false)

    for (let t = 0; t < ATTACK_INTERVAL; t += DELTA) tick(world)
    expect(mine.has(WantsToAttack)).toBe(true)
  })

  it('alvo desmaiou: troca pra outra selvagem que está lutando com o grupo', () => {
    const { world, trainer } = setup()
    const mine = spawnPartyCreature(world, at(0, 3))
    const first = spawnWild(world, at(0, 5))
    const second = spawnWild(world, at(2, 5))
    perseguirJogador(second, { provoked: true })
    second.set(WildBehavior, { target: trainer })
    defenderGrupo(mine, first)

    desmaiar(world, first)
    tick(world)

    expect(stateOf(mine)).toMatchObject({ state: 'fight', target: second })
  })

  it('alvo saiu da luta e ninguém mais luta com o grupo: volta a seguir', () => {
    const { world } = setup()
    const mine = spawnPartyCreature(world, at(0, 3))
    const wild = spawnWild(world, at(0, 5))
    defenderGrupo(mine, wild)

    desmaiar(world, wild)
    tick(world)

    expect(stateOf(mine)).toMatchObject({ state: 'follow', target: null })
  })

  it(`longe demais de quem segue (> ${LEASH_RADIUS}m): larga a luta`, () => {
    const { world } = setup()
    const mine = spawnPartyCreature(world, at(0, LEASH_RADIUS + 1))
    const wild = spawnWild(world, at(0, LEASH_RADIUS + 3))
    defenderGrupo(mine, wild)

    tick(world)

    expect(stateOf(mine).state).toBe('follow')
  })

  it('virou a controlada: larga a luta (quem move é o jogador)', () => {
    const { world, trainer } = setup()
    const mine = spawnPartyCreature(world, at(0, 3))
    const wild = spawnWild(world, at(0, 5))
    defenderGrupo(mine, wild)
    trainer.remove(InputControlled)
    mine.add(InputControlled)

    tick(world)

    expect(stateOf(mine).state).toBe('follow')
  })

  it('desmaiar tira da luta', () => {
    const { world } = setup()
    const mine = spawnPartyCreature(world, at(0, 3))
    const wild = spawnWild(world, at(0, 5))
    defenderGrupo(mine, wild)

    desmaiar(world, mine)

    expect(stateOf(mine)).toMatchObject({ state: 'follow', target: null })
  })
})

describe('luta em grupo de ponta a ponta', () => {
  it('selvagem hostil bate no treinador; a criatura do time entra na luta e tira vida dela', () => {
    const { world, trainer } = setup()
    // Sem física ninguém anda de verdade: todos já estão ao alcance.
    const mine = spawnPartyCreature(world, at(1.2, 1.2))
    const wild = spawnWild(world, at(0, 1.2))
    const wildHpBefore = wild.get(Vitals).hp
    const trainerHpBefore = trainer.get(Vitals).hp
    const events = createEventQueue()

    for (let i = 0; i < 400; i++) {
      events.beginStep()
      const ctx = { world, delta: DELTA, input: {}, events }
      creatureAttackSystem(ctx)
      partyBehaviorSystem(ctx)
      creatureFollowSystem(ctx)
      wildBehaviorSystem(ctx)
      wildReactionSystem(ctx)
      partyReactionSystem(ctx)
    }

    expect(trainer.get(Vitals).hp).toBeLessThan(trainerHpBefore)
    expect(stateOf(mine).state).toBe('fight')
    expect(wild.get(Vitals).hp).toBeLessThan(wildHpBefore)
  })
})
