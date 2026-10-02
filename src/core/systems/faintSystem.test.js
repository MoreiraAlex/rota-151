import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { createWorld } from 'koota'
import { makeWorld } from '@/test/makeWorld'
import { initTestTerrain, settleTerrain } from '@/test/physicsTerrain'
import { getSpecies } from '../data/species'
import { resolveAnimationState } from '../data/animationStates'
import { createEventQueue, attackResolved } from '../events'
import { GAME_CONFIG } from '../gameConfig'
import { createCharacterBody } from '../physics/colliders'
import { stepPhysics } from '../physics/physicsWorld'
import { castRay } from '../physics/raycast'
import { acordar, desmaiar, resolveReviveHp } from '../actions/faint'
import { entrarEmCombate } from '../actions/combat'
import { perseguirJogador } from '../actions/wildBehavior'
import {
  AiMovement,
  ActionState,
  AttackAim,
  CameraTarget,
  CharacterController,
  CombatMode,
  Fainted,
  InputControlled,
  Mood,
  MovementStats,
  Party,
  PartyFaint,
  PartyVitals,
  PathState,
  PhysicsBody,
  Position,
  Rotation,
  SummonBall,
  SummonedCreature,
  Velocity,
  Vitals,
  WantsToAttack,
  WanderState,
  WildBehavior,
  WildCreature,
  vitalsFromSpecies,
} from '../traits'
import { controlSwitchSystem } from './controlSwitchSystem'
import { creatureFollowSystem } from './creatureFollowSystem'
import { faintSystem, isPartySlotFainted } from './faintSystem'
import { partySummonSystem } from './partySummonSystem'
import { summonBallSystem } from './summonBallSystem'
import { vitalsRegenSystem } from './vitalsRegenSystem'
import { wildBehaviorSystem } from './wildBehaviorSystem'
import { wildReactionSystem } from './wildReactionSystem'
import { wildWanderSystem } from './wildWanderSystem'

const DELTA = 1 / 60
const { DURATION_MINUTES, REVIVE_HP_FRACTION, PARTY_RECALL_DELAY } =
  GAME_CONFIG.FAINT
const DURATION = DURATION_MINUTES * 60
const SPECIES = getSpecies('charmander')
const WILD_AT = { x: 30, y: 0.45, z: 30 }

const worlds = []
afterEach(() => {
  while (worlds.length) worlds.pop().destroy()
})

function spawnWild(world, { at = WILD_AT, physicsBody } = {}) {
  return world.spawn(
    WildCreature({ speciesId: 'charmander' }),
    WildBehavior({ temperament: 'hostile' }),
    AiMovement,
    Position(at),
    Rotation,
    Velocity,
    MovementStats(SPECIES.movement),
    CharacterController(SPECIES.body),
    PhysicsBody(physicsBody ?? {}),
    PathState,
    WanderState({ homeX: at.x, homeZ: at.z }),
    Mood,
    ActionState,
    AttackAim,
    vitalsFromSpecies(SPECIES),
  )
}

function setupWild() {
  const world = createWorld()
  worlds.push(world)
  const wild = spawnWild(world)
  return { world, wild }
}

/** Avança o `faintSystem` por `seconds` (em ticks fixos). */
function runFaint(world, seconds) {
  const ticks = Math.round(seconds / DELTA)
  for (let i = 0; i < ticks; i++) faintSystem({ world, delta: DELTA })
}

describe('faintSystem — selvagem', () => {
  it('chegou a 0 de HP: desmaia, larga o golpe/combate, para e fecha o olho', () => {
    const { world, wild } = setupWild()
    entrarEmCombate(wild)
    wild.add(WantsToAttack)
    wild.set(ActionState, {
      current: 'attack',
      elapsed: 0.1,
      pendingSlot: 'primary',
    })
    wild.set(AttackAim, { slot: 'primary' })
    wild.set(Velocity, { x: 3, y: 0, z: 2 })
    wild.set(Vitals, { hp: 0 })

    faintSystem({ world, delta: DELTA })

    expect(wild.has(Fainted)).toBe(true)
    // Já contou o próprio tick em que desmaiou.
    expect(wild.get(Fainted).timeLeft).toBeCloseTo(DURATION - DELTA)
    expect(wild.get(ActionState).current).toBe(null)
    expect(wild.get(ActionState).pendingSlot).toBe(null)
    expect(wild.get(AttackAim).slot).toBe(null)
    expect(wild.has(WantsToAttack)).toBe(false)
    expect(wild.has(CombatMode)).toBe(false)
    expect(wild.get(Mood).state).toBe('faint')
    expect(wild.get(Velocity).x).toBe(0)
    expect(wild.get(Velocity).z).toBe(0)
  })

  it('com HP sobrando, não desmaia', () => {
    const { world, wild } = setupWild()
    wild.set(Vitals, { hp: 1 })

    faintSystem({ world, delta: DELTA })

    expect(wild.has(Fainted)).toBe(false)
  })

  it('desmaiada não regenera HP nem stamina', () => {
    const { world, wild } = setupWild()
    wild.set(Vitals, {
      hp: 0,
      hpRegenDelay: 0,
      stamina: 0,
      staminaRegenDelay: 0,
    })
    faintSystem({ world, delta: DELTA })

    for (let i = 0; i < 120; i++) vitalsRegenSystem({ world, delta: DELTA })

    expect(wild.get(Vitals).hp).toBe(0)
    expect(wild.get(Vitals).stamina).toBe(0)
  })

  it(`acorda depois de ${DURATION_MINUTES} min com ${REVIVE_HP_FRACTION * 100}% do HP e volta a vagar de onde caiu; aí regenera`, () => {
    const { world, wild } = setupWild()
    perseguirJogador(wild, { provoked: true })
    wild.set(Vitals, { hp: 0 })
    faintSystem({ world, delta: DELTA })

    runFaint(world, DURATION - 1)
    expect(wild.has(Fainted)).toBe(true)
    expect(wild.get(Vitals).hp).toBe(0)

    runFaint(world, 1 + DELTA)
    const vitals = wild.get(Vitals)
    expect(wild.has(Fainted)).toBe(false)
    expect(vitals.hp).toBe(Math.ceil(vitals.maxHp * REVIVE_HP_FRACTION))
    expect(wild.get(Mood).state).toBe('awake')
    expect(wild.get(WildBehavior).state).toBe('wander')
    expect(wild.get(WildBehavior).provoked).toBe(false)
    expect(wild.get(WanderState).homeX).toBe(WILD_AT.x)

    vitalsRegenSystem({ world, delta: 1 })
    expect(wild.get(Vitals).hp).toBeGreaterThan(vitals.hp)
  })

  it('HP de quem acorda nunca é 0 (arredonda pra cima)', () => {
    expect(resolveReviveHp(3)).toBe(
      Math.max(1, Math.ceil(3 * REVIVE_HP_FRACTION)),
    )
    expect(resolveReviveHp(1)).toBe(1)
  })

  it('o treinador não desmaia', () => {
    const { world, player } = makeWorld()
    worlds.push(world)
    player.set(Vitals, { hp: 0 })

    faintSystem({ world, delta: DELTA })

    expect(player.has(Fainted)).toBe(false)
  })

  it('desmaiada ignora o comportamento (não persegue, não pede golpe, não vaga)', () => {
    const { world, wild } = setupWild()
    // O treinador no controle, ao lado dela.
    world.spawn(
      InputControlled,
      Party,
      Position({ x: WILD_AT.x, y: WILD_AT.y, z: WILD_AT.z + 1.5 }),
      CharacterController(SPECIES.body),
    )
    // Caiu no meio da perseguição: o estado fica, mas nada acontece.
    perseguirJogador(wild, { provoked: true })
    wild.set(Vitals, { hp: 0 })
    faintSystem({ world, delta: DELTA })

    for (let i = 0; i < 60; i++) {
      wildBehaviorSystem({ world, delta: DELTA })
      wildWanderSystem({ world, delta: DELTA })
    }

    expect(wild.has(WantsToAttack)).toBe(false)
    expect(wild.has(CombatMode)).toBe(false)
    expect(wild.get(Velocity).x).toBe(0)
    expect(wild.get(Velocity).z).toBe(0)

    // Controle: acordada, volta a vagar e, com o alvo ao lado, persegue.
    acordar(wild)
    expect(wild.get(WildBehavior).state).toBe('wander')
    wildBehaviorSystem({ world, delta: DELTA })
    expect(wild.get(WildBehavior).state).toBe('chase')
  })

  it('o golpe que derrubou não provoca reação (desmaiada não revida)', () => {
    const { world, wild } = setupWild()
    wild.set(Vitals, { hp: 0 })
    faintSystem({ world, delta: DELTA })

    const events = createEventQueue()
    events.beginStep()
    events.emit(attackResolved({ attacker: null, target: wild, damage: 10 }))
    wildReactionSystem({ world, events })

    expect(wild.get(WildBehavior).state).toBe('wander')
  })

  it('animação: desmaiada resolve pro estado "faint", acima de qualquer ação', () => {
    expect(
      resolveAnimationState({
        speed: 0,
        grounded: true,
        action: 'attack',
        fainted: true,
      }),
    ).toBe('faint')
    expect(
      resolveAnimationState({
        speed: 0,
        grounded: true,
        action: null,
        fainted: false,
      }),
    ).toBe('idle')
  })
})

describe('faintSystem — intangível (física)', () => {
  beforeAll(async () => {
    await initTestTerrain()
  })

  it('desmaiada sai do raycast; acordada volta', () => {
    const world = createWorld()
    worlds.push(world)
    const at = { x: -30, y: 1, z: -30 }
    const body = createCharacterBody(at, { radius: 0.5, halfHeight: 0.5 })
    settleTerrain()
    const wild = spawnWild(world, { at, physicsBody: body })

    const probe = () =>
      castRay({ x: at.x - 3, y: at.y, z: at.z }, { x: 1, y: 0, z: 0 }, 6)
    expect(probe()?.colliderHandle).toBe(body.colliderHandle)

    desmaiar(world, wild)
    stepPhysics()
    expect(probe()).toBe(null)

    acordar(wild)
    stepPhysics()
    expect(probe()?.colliderHandle).toBe(body.colliderHandle)
  })
})

// ---------------------------------------------------------------------------
// Time: recolher sozinha, contar na bola, bloquear invocação, reanimar.

function tickParty(world, input = {}) {
  controlSwitchSystem({ world, input })
  faintSystem({ world, delta: DELTA })
  partySummonSystem({ world, delta: DELTA, input })
  summonBallSystem({ world, delta: DELTA })
}

function tickPartyFor(world, seconds, input = {}) {
  const ticks = Math.round(seconds / DELTA)
  for (let i = 0; i < ticks; i++) tickParty(world, input)
}

function summonSlot1(world, player) {
  tickParty(world, { secondary1: true })
  let guard = 0
  while (
    player.get(ActionState).current !== null ||
    world.query(SummonBall).length > 0
  ) {
    tickParty(world)
    if (++guard > 2000) throw new Error('invocação nunca resolveu')
  }
  return world.query(SummonedCreature)[0]
}

function recallUntilDone(world, player) {
  let guard = 0
  while (player.get(ActionState).current !== null) {
    tickParty(world)
    if (++guard > 1000) throw new Error('recall nunca terminou')
  }
}

function setupParty() {
  const { world, player } = makeWorld()
  worlds.push(world)
  player.set(Party, { slot1: 'fox-red' })
  const creature = summonSlot1(world, player)
  return { world, player, creature }
}

describe('faintSystem — criatura do time', () => {
  it('desmaiando no controle, o controle volta pro treinador; não dá pra pilotá-la de novo', () => {
    const { world, player, creature } = setupParty()
    tickParty(world, { switchSlot1: true })
    expect(creature.has(InputControlled)).toBe(true)

    creature.set(Vitals, { hp: 0 })
    tickParty(world)

    expect(creature.has(Fainted)).toBe(true)
    expect(creature.has(InputControlled)).toBe(false)
    expect(creature.has(CameraTarget)).toBe(false)
    expect(player.has(InputControlled)).toBe(true)
    expect(player.has(CameraTarget)).toBe(true)

    tickParty(world, { switchSlot1: true })
    expect(player.has(InputControlled)).toBe(true)
  })

  it(`é recolhida sozinha ${PARTY_RECALL_DELAY}s depois de desmaiar, e a contagem segue no treinador`, () => {
    const { world, player, creature } = setupParty()
    creature.set(Vitals, { hp: 0 })
    tickParty(world)

    tickPartyFor(world, PARTY_RECALL_DELAY - 0.5)
    expect(player.get(ActionState).current).toBe(null)
    expect(creature.isAlive()).toBe(true)

    tickPartyFor(world, 0.5 + DELTA)
    expect(player.get(ActionState).current).toBe('recall')

    let guard = 0
    while (player.get(ActionState).current !== null) {
      tickParty(world)
      if (++guard > 1000) throw new Error('recall nunca terminou')
    }
    expect(world.query(SummonedCreature).length).toBe(0)

    const slotFaint = player.get(PartyFaint).slot1
    expect(slotFaint.timeLeft).toBeGreaterThan(
      DURATION - PARTY_RECALL_DELAY - 2,
    )
    expect(slotFaint.timeLeft).toBeLessThan(DURATION - PARTY_RECALL_DELAY)
    expect(isPartySlotFainted(player, 'slot1')).toBe(true)
  })

  it('desmaiada na bola não pode ser invocada; reanima lá dentro e sai com o HP de quem acorda', () => {
    const { world, player, creature } = setupParty()
    creature.set(Vitals, { hp: 0 })
    tickParty(world)
    tickParty(world, { secondary1: true }) // recolhe na hora
    recallUntilDone(world, player)
    expect(player.get(PartyVitals).slot1.hp).toBe(0)
    // Encurta a contagem (a regra é a mesma com 3s ou 2 min).
    player.set(PartyFaint, { slot1: { timeLeft: 3 } })

    tickParty(world, { secondary1: true })
    expect(player.get(ActionState).current).toBe(null)
    expect(world.query(SummonBall).length).toBe(0)

    tickPartyFor(world, 3 + DELTA)
    expect(player.get(PartyFaint).slot1).toBe(null)
    expect(isPartySlotFainted(player, 'slot1')).toBe(false)
    const stored = player.get(PartyVitals).slot1
    expect(stored.hp).toBe(resolveReviveHp(stored.maxHp))
    expect(stored.hpRegenDelay).toBe(0)

    const revived = summonSlot1(world, player)
    const vitals = revived.get(Vitals)
    expect(vitals.hp).toBe(resolveReviveHp(vitals.maxHp))
    expect(vitals.hp).toBeLessThan(vitals.maxHp)
    expect(player.get(PartyVitals).slot1).toBe(null)
  })

  it('desmaiada não segue o treinador (fica largada no chão)', () => {
    const { world, creature } = setupParty()
    const pos = creature.get(Position)
    creature.set(Position, { x: pos.x + 20, y: pos.y, z: pos.z })

    creatureFollowSystem({ world, delta: DELTA })
    // Controle: longe do treinador, a saudável anda até ele.
    expect(
      Math.hypot(creature.get(Velocity).x, creature.get(Velocity).z),
    ).toBeGreaterThan(0)

    creature.set(Vitals, { hp: 0 })
    faintSystem({ world, delta: DELTA })
    creatureFollowSystem({ world, delta: DELTA })
    expect(creature.get(Velocity).x).toBe(0)
    expect(creature.get(Velocity).z).toBe(0)
  })

  it('controle: saudável, sai da bola com HP cheio', () => {
    const { creature } = setupParty()
    const vitals = creature.get(Vitals)
    expect(vitals.hp).toBe(vitals.maxHp)
  })

  it('apertar a tecla com ela desmaiada no chão recolhe na hora (sem esperar)', () => {
    const { world, player, creature } = setupParty()
    creature.set(Vitals, { hp: 0 })
    tickParty(world)

    tickParty(world, { secondary1: true })

    expect(player.get(ActionState).current).toBe('recall')
  })
})
