import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { makeWorld } from '@/test/makeWorld'
import { disposePhysics, initPhysics } from '@/core/physics/physicsWorld'
import { resolveMoveSpeed } from '../actions/movementSpeed'
import { perseguirJogador } from '../actions/wildBehavior'
import { resolveCreatureAttack } from '../battle/creatureAttack'
import { getSpecies } from '../data/species'
import { GAME_CONFIG } from '../gameConfig'
import {
  ActionState,
  AiMovement,
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
  TrainerBehavior,
  Velocity,
  Vitals,
  WanderState,
  WildBehavior,
  WildCreature,
  vitalsFromSpecies,
} from '../traits'
import { createEventQueue } from '../events'
import { creatureAttackSystem } from './creatureAttackSystem'
import { characterPhysicsSystem } from './characterPhysicsSystem'
import { creatureFollowSystem } from './creatureFollowSystem'
import { partyBehaviorSystem } from './partyBehaviorSystem'
import { physicsBootstrapSystem } from './physicsBootstrapSystem'
import { physicsStepSystem } from './physicsStepSystem'
import { syncPhysicsSystem } from './syncPhysicsSystem'
import { wildBehaviorSystem } from './wildBehaviorSystem'
import { trainerBattleSystem } from './trainerBattleSystem'

const DELTA = 1 / 60
const CHARMANDER = getSpecies('charmander')
const { SAFE_DISTANCE, ARRIVE_DISTANCE } = GAME_CONFIG.TRAINER_BATTLE
// Longe dos obstáculos do nível de teste.
const BASE = { x: 30, y: 0.45, z: 30 }
const at = (dx, dz) => ({ x: BASE.x + dx, y: BASE.y, z: BASE.z + dz })

const worlds = []
afterEach(() => {
  while (worlds.length) worlds.pop().destroy()
})

/**
 * Treinador em BASE, fora do controle; a criatura do jogador (controlada)
 * 2m em +Z; uma selvagem lutando com o grupo mais à frente, em +Z.
 */
function setup({ wildAt = at(0, 6), wildTarget = 'creature' } = {}) {
  const { world, player: trainer } = makeWorld({ playerPosition: at(0, 0) })
  worlds.push(world)
  trainer.remove(InputControlled)
  const creature = world.spawn(
    SummonedCreature({ slot: 'slot1', speciesId: 'charmander' }),
    InputControlled,
    Position(at(0, 2)),
    CharacterController(CHARMANDER.body),
    vitalsFromSpecies(CHARMANDER),
  )
  const wild = world.spawn(
    WildCreature({ speciesId: 'charmander' }),
    WildBehavior({ temperament: 'hostile' }),
    Position(wildAt),
    CharacterController(CHARMANDER.body),
    ActionState,
    IndividualValues,
    vitalsFromSpecies(CHARMANDER),
  )
  perseguirJogador(wild, { provoked: true })
  wild.set(WildBehavior, {
    target: wildTarget === 'trainer' ? trainer : creature,
  })
  const tick = () => {
    trainerBattleSystem({ world, delta: DELTA })
    creatureFollowSystem({ world, delta: DELTA })
  }
  return { world, trainer, creature, wild, tick }
}

const stateOf = (trainer) => trainer.get(TrainerBehavior).state
const velOf = (entity) => entity.get(Velocity)

describe('trainerBattleSystem — treinador fora do controle numa luta', () => {
  it('sem luta: segue como sempre (follow)', () => {
    const { trainer, wild, tick } = setup()
    perseguirJogador(wild, { provoked: false })
    wild.set(WildBehavior, { state: 'wander', target: null })

    tick()

    expect(stateOf(trainer)).toBe('follow')
  })

  it('no controle: segue as regras do jogador (follow)', () => {
    const { trainer, creature, tick } = setup()
    creature.remove(InputControlled)
    trainer.add(InputControlled)

    tick()

    expect(stateOf(trainer)).toBe('follow')
  })

  it('já na zona segura (longe da selvagem, perto da criatura): fica parado', () => {
    const { trainer, tick } = setup() // selvagem a 6m dele, criatura a 2m
    tick()
    expect(stateOf(trainer)).toBe('safe')
    expect(Math.hypot(velOf(trainer).x, velOf(trainer).z)).toBe(0)
  })

  it('perto da luta: vai pra posição segura, atrás da criatura (longe da selvagem)', () => {
    const { trainer, tick } = setup({ wildAt: at(0, 4) })
    // Selvagem a 4m dele (< SAFE_MIN_DISTANCE): o ponto é 2 - SAFE_DISTANCE
    // (atrás da criatura, -Z).
    // Começa virado pra +Z: dá tempo de virar.
    for (let i = 0; i < 90; i++) tick()

    expect(stateOf(trainer)).toBe('safe')
    expect(velOf(trainer).z).toBeLessThan(0)
  })

  it('indo pro ponto seguro: a selvagem mudar de lado não muda o ponto (guardado)', () => {
    const { trainer, wild, tick } = setup({ wildAt: at(0, 4) })
    tick()
    const { safeX, safeZ } = trainer.get(TrainerBehavior)

    // A selvagem rodeia a criatura (vai pro lado), longe do ponto guardado.
    wild.set(Position, at(3, 3))
    tick()

    expect(trainer.get(TrainerBehavior)).toMatchObject({ safeX, safeZ })
  })

  it('indo pro ponto: grava o caminho no PathState (debug e repath)', () => {
    const { trainer, tick } = setup({ wildAt: at(0, 4) })
    tick()
    const { safeX, safeZ } = trainer.get(TrainerBehavior)

    expect(trainer.get(PathState).target).toEqual({ x: safeX, z: safeZ })
    expect(trainer.get(PathState).repathTimer).toBeGreaterThan(0)
  })

  it('indo pro ponto: voltar à zona no caminho não faz ele parar antes de chegar', () => {
    const { trainer, wild, tick } = setup({ wildAt: at(0, 4) })
    tick()
    expect(trainer.get(TrainerBehavior).hasSafePoint).toBe(true)

    // A selvagem se afasta: a posição atual dele já é zona segura.
    wild.set(Position, at(0, 6))
    tick()

    expect(stateOf(trainer)).toBe('safe')
    expect(trainer.get(TrainerBehavior).hasSafePoint).toBe(true)
    expect(Math.hypot(velOf(trainer).x, velOf(trainer).z)).toBeGreaterThan(0)
  })

  it('a luta acaba no caminho: o ponto guardado é descartado', () => {
    const { trainer, wild, tick } = setup({ wildAt: at(0, 4) })
    tick()
    expect(trainer.get(TrainerBehavior).hasSafePoint).toBe(true)

    wild.set(WildBehavior, { state: 'wander', target: null })
    tick()

    expect(stateOf(trainer)).toBe('follow')
    expect(trainer.get(TrainerBehavior).hasSafePoint).toBe(false)
  })

  it('chegando na posição segura: para', () => {
    const { trainer, tick } = setup({ wildAt: at(0, 4) })
    trainer.set(Position, at(0, 2 - SAFE_DISTANCE + ARRIVE_DISTANCE / 2))

    tick()

    expect(stateOf(trainer)).toBe('safe')
    expect(Math.hypot(velOf(trainer).x, velOf(trainer).z)).toBe(0)
  })

  it('dentro do aviso de um golpe: desvia pro lado (sem sorteio)', () => {
    const { trainer, wild, tick } = setup({ wildAt: at(0.1, -1) })
    // Selvagem 1m atrás dele golpeando pra +Z, ele 0.1m pro lado.
    const basic = resolveCreatureAttack(CHARMANDER, 'primary')
    wild.set(ActionState, {
      current: 'attack',
      pendingSlot: 'primary',
      elapsed: 0.05,
      animationSpeed: 1 / basic.duration,
      dirX: 0,
      dirZ: 1,
    })

    tick()

    expect(stateOf(trainer)).toBe('dodge')
    expect(velOf(trainer).x).toBeLessThan(0) // ele está em -0.1 em relação a ela
  })

  it('desviando: o corpo gira pro lado do desvio', () => {
    const { trainer, wild, tick } = setup({ wildAt: at(0.1, -1) })
    const basic = resolveCreatureAttack(CHARMANDER, 'primary')
    wild.set(ActionState, {
      current: 'attack',
      pendingSlot: 'primary',
      elapsed: 0,
      animationSpeed: 1 / basic.duration,
      dirX: 0,
      dirZ: 1,
    })

    for (let i = 0; i < 5; i++) tick()

    expect(stateOf(trainer)).toBe('dodge')
    // Começa virado pra +Z (yaw 0); o desvio é pra -X (yaw -π/2).
    expect(trainer.get(Rotation).y).toBeLessThan(-0.3)
  })

  it('mirado por uma selvagem: corre pra perto da criatura do time', () => {
    const { trainer, creature, tick } = setup({ wildTarget: 'trainer' })
    creature.set(Position, at(0, -6)) // o time atrás dele
    // Começa virado pra +Z: dá tempo de virar.
    for (let i = 0; i < 90; i++) tick()

    expect(stateOf(trainer)).toBe('toTeam')
    expect(velOf(trainer).z).toBeLessThan(0)
  })

  it('fora de follow, o creatureFollowSystem não move o treinador', () => {
    const { trainer, world } = setup()
    trainer.set(TrainerBehavior, { state: 'safe' })
    trainer.set(Velocity, { x: 0, z: 0 })
    trainer.set(PathState, { waypoints: [] })

    creatureFollowSystem({ world, delta: DELTA })

    expect(Math.hypot(velOf(trainer).x, velOf(trainer).z)).toBe(0)
  })

  it('ferido, anda mais devagar até a posição segura', () => {
    const { trainer, tick } = setup({ wildAt: at(0, 4.5) })
    trainer.set(Vitals, { hp: trainer.get(Vitals).maxHp * 0.1 })
    // Selvagem longe dele (> DANGER_DISTANCE): anda.
    for (let i = 0; i < 90; i++) tick()

    const expected = resolveMoveSpeed(
      trainer.get(MovementStats),
      trainer.get(Vitals),
      false,
    )
    expect(expected).toBeLessThan(trainer.get(MovementStats).walkSpeed)
    expect(Math.hypot(velOf(trainer).x, velOf(trainer).z)).toBeCloseTo(expected)
  })
})

describe('trainerBattleSystem — regressão: andando em círculos', () => {
  // Relatado jogando: "assim que entra em combate, ele fica andando em
  // círculos no mesmo ponto". O ponto seguro era recalculado todo tick pela
  // selvagem mais perto da criatura — que RODEIA a criatura (Parte 2) —, então
  // o ponto girava e ele ia atrás. Luta de verdade (selvagem lutando com a
  // criatura controlada), posições integradas à mão.
  it('com a selvagem rodeando a criatura, ele se posiciona e quase não anda mais', () => {
    const { world, player: trainer } = makeWorld({ playerPosition: at(0, 0) })
    worlds.push(world)
    trainer.remove(InputControlled)
    world.spawn(
      SummonedCreature({ slot: 'slot1', speciesId: 'charmander' }),
      InputControlled,
      PartyBehavior,
      AiMovement,
      Position(at(0, 2)),
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
    world.spawn(
      WildCreature({ speciesId: 'charmander' }),
      WildBehavior({ temperament: 'hostile' }),
      AiMovement,
      Position(at(0, 6)),
      Rotation,
      Velocity,
      MovementStats(CHARMANDER.movement),
      CharacterController(CHARMANDER.body),
      PhysicsBody,
      PathState,
      WanderState({ homeX: BASE.x, homeZ: BASE.z + 6 }),
      ActionState,
      AttackCooldowns,
      IndividualValues,
      Mood,
      vitalsFromSpecies(CHARMANDER),
    )
    const events = createEventQueue()
    let travelled = 0
    for (let i = 0; i < 600; i++) {
      events.beginStep()
      const ctx = { world, delta: DELTA, input: {}, events }
      creatureAttackSystem(ctx)
      wildBehaviorSystem(ctx)
      trainerBattleSystem(ctx)
      creatureFollowSystem(ctx)
      world.query(Position, Velocity).updateEach(([pos, vel]) => {
        pos.x += vel.x * DELTA
        pos.z += vel.z * DELTA
      })
      if (i >= 300) {
        const vel = trainer.get(Velocity)
        travelled += Math.hypot(vel.x, vel.z) * DELTA
      }
    }

    expect(trainer.get(TrainerBehavior).state).toBe('safe')
    // Nos últimos 5s: só correções curtas, não andando sem parar.
    expect(travelled).toBeLessThan(3)
  })
})

describe('trainerBattleSystem — regressão: meia-volta na borda da zona (com física)', () => {
  // Relatado jogando: "ao chegar perto, parece que surta e fica girando". Ele
  // parava ao reentrar na zona segura (a selvagem rodeando entra e sai dos
  // SAFE_MIN_DISTANCE) e saía de novo logo depois — de costas pra luta, de
  // frente, de costas... Pipeline físico de verdade, na ordem do jogo.
  beforeEach(async () => {
    await initPhysics()
  })
  afterEach(() => disposePhysics())

  it('com a selvagem rodeando, ele sai pro ponto uma vez e não fica parando e saindo', () => {
    const { world, player: trainer } = makeWorld({ playerPosition: at(0, 0) })
    worlds.push(world)
    trainer.remove(InputControlled)
    const creature = world.spawn(
      SummonedCreature({ slot: 'slot1', speciesId: 'charmander' }),
      InputControlled,
      PartyBehavior,
      AiMovement,
      Position(at(0, 2)),
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
    const wild = world.spawn(
      WildCreature({ speciesId: 'charmander' }),
      WildBehavior({ temperament: 'hostile' }),
      AiMovement,
      Position(at(0, 9)),
      Rotation,
      Velocity,
      MovementStats(CHARMANDER.movement),
      CharacterController(CHARMANDER.body),
      PhysicsBody,
      PathState,
      WanderState({ homeX: BASE.x, homeZ: BASE.z + 9 }),
      ActionState,
      AttackCooldowns,
      IndividualValues,
      Mood,
      vitalsFromSpecies(CHARMANDER),
    )
    const events = createEventQueue()
    physicsBootstrapSystem({ world, delta: DELTA })
    perseguirJogador(wild, { provoked: true })
    wild.set(WildBehavior, { target: creature })

    let departures = 0
    let wasStopped = false
    for (let i = 0; i < 60 * 15; i++) {
      events.beginStep()
      const ctx = { world, delta: DELTA, input: {}, events }
      creatureAttackSystem(ctx)
      partyBehaviorSystem(ctx)
      trainerBattleSystem(ctx)
      creatureFollowSystem(ctx)
      wildBehaviorSystem(ctx)
      characterPhysicsSystem(ctx)
      physicsStepSystem(ctx)
      syncPhysicsSystem(ctx)

      const vel = trainer.get(Velocity)
      const moving = Math.hypot(vel.x, vel.z) > 0
      const safe = stateOf(trainer) === 'safe'
      if (safe && moving && wasStopped) departures++
      wasStopped = safe && !moving
    }

    // Uma saída pro ponto (o começo da luta); o código antigo saía 5 vezes.
    expect(departures).toBeLessThanOrEqual(1)
  })
})
