import { afterEach, describe, expect, it } from 'vitest'
import { createWorld } from 'koota'
import {
  fugirDoJogador,
  perseguirJogador,
  registrarAmeaca,
  voltarAVagar,
} from '../actions/wildBehavior'
import { resolveCreatureAttack } from '../data/attacks'
import { getPlayerSpecies, getSpecies } from '../data/species'
import { GAME_CONFIG } from '../gameConfig'
import {
  ActionState,
  AttackCooldowns,
  CharacterController,
  CombatMode,
  Fainted,
  InputControlled,
  Mood,
  MovementStats,
  Party,
  PathState,
  PhysicsBody,
  Position,
  Rotation,
  SummonedCreature,
  Threat,
  Velocity,
  Vitals,
  IndividualValues,
  WantsToAttack,
  WanderState,
  WildBehavior,
  WildCreature,
  vitalsFromSpecies,
} from '../traits'
import { createEventQueue } from '../events'
import { creatureAttackSystem } from './creatureAttackSystem'
import { wildBehaviorSystem } from './wildBehaviorSystem'

const {
  ATTACK_INTERVAL,
  AGGRO_RADIUS,
  AGGRO_EXIT_MARGIN,
  CHASE_STOP_GAP,
  RETALIATE_LEASH_RADIUS,
  FLEE_SAFE_DISTANCE,
} = GAME_CONFIG.WILD_BEHAVIOR
const DELTA = 1 / 60
const SPECIES = getSpecies('charmander')
// Longe dos obstáculos do nível de teste (mesma região de outros testes).
const WILD_AT = { x: 30, y: 0.45, z: 30 }

const worlds = []
afterEach(() => {
  while (worlds.length) worlds.pop().destroy()
})

function setup({ temperament = 'hostile', playerAt } = {}) {
  const world = createWorld()
  worlds.push(world)
  // O treinador (`Party`) no controle — alvo do lado do jogador.
  const player = world.spawn(
    InputControlled,
    Party,
    Position(playerAt ?? { x: 30, y: 0.45, z: 30 + AGGRO_RADIUS + 5 }),
    CharacterController(SPECIES.body),
    Vitals,
  )
  const wild = world.spawn(
    WildCreature({ speciesId: 'charmander' }),
    WildBehavior({ temperament }),
    Position(WILD_AT),
    Rotation,
    Velocity,
    MovementStats(SPECIES.movement),
    CharacterController(SPECIES.body),
    PhysicsBody,
    PathState,
    WanderState({ homeX: WILD_AT.x, homeZ: WILD_AT.z }),
    Mood,
    ActionState,
    vitalsFromSpecies(SPECIES),
  )
  const tick = () => wildBehaviorSystem({ world, delta: DELTA })
  const movePlayer = (distance) =>
    player.set(Position, { x: 30, y: 0.45, z: 30 + distance })
  return { world, player, wild, tick, movePlayer }
}

const state = (wild) => wild.get(WildBehavior).state

describe('wildBehaviorSystem — hostil', () => {
  it('fora do raio de aggro, continua vagando', () => {
    const { wild, tick } = setup()

    tick()

    expect(state(wild)).toBe('wander')
  })

  it('dentro do raio, passa a perseguir e corre na direção do jogador', () => {
    const { wild, tick, movePlayer } = setup()
    movePlayer(AGGRO_RADIUS - 1)

    tick() // decide perseguir
    tick() // move

    expect(state(wild)).toBe('chase')
    const vel = wild.get(Velocity)
    expect(vel.z).toBeGreaterThan(0) // jogador está em +Z
    expect(Math.hypot(vel.x, vel.z)).toBeCloseTo(SPECIES.movement.runSpeed)
  })

  it('perseguindo entra em modo combate (olho bravo)', () => {
    const { wild, tick, movePlayer } = setup()
    movePlayer(AGGRO_RADIUS - 1)

    tick()
    tick()

    expect(wild.has(CombatMode)).toBe(true)
    expect(wild.get(Mood).state).toBe('angry')
  })

  it('logo depois do raio (dentro da folga) continua perseguindo; além dela, desiste e vaga dali', () => {
    const { wild, tick, movePlayer } = setup()
    movePlayer(AGGRO_RADIUS - 1)
    tick()

    movePlayer(AGGRO_RADIUS + AGGRO_EXIT_MARGIN / 2)
    tick()
    expect(state(wild)).toBe('chase')

    movePlayer(AGGRO_RADIUS + AGGRO_EXIT_MARGIN + 1)
    tick()
    expect(state(wild)).toBe('wander')
    // Vaga a partir de onde está, não volta pro ponto de spawn.
    const wander = wild.get(WanderState)
    const pos = wild.get(Position)
    expect(wander.homeX).toBeCloseTo(pos.x)
    expect(wander.homeZ).toBeCloseTo(pos.z)
  })

  it('perto o bastante (vão entre os corpos ≤ CHASE_STOP_GAP), para e encara o jogador', () => {
    const { wild, tick, movePlayer } = setup()
    const touching = SPECIES.body.capsuleRadius * 2 + CHASE_STOP_GAP / 2
    movePlayer(touching)
    wild.set(Rotation, { y: Math.PI }) // de costas pro jogador

    tick() // decide perseguir
    tick() // perto: para e gira

    const vel = wild.get(Velocity)
    expect(vel.x).toBe(0)
    expect(vel.z).toBe(0)
    expect(Math.abs(wild.get(Rotation).y)).toBeLessThan(Math.PI) // girando pra +Z (yaw 0)
  })

  it('provocada (apanhou) só desiste além de RETALIATE_LEASH_RADIUS', () => {
    const { wild, tick, movePlayer } = setup()
    perseguirJogador(wild, { provoked: true })

    movePlayer(AGGRO_RADIUS + AGGRO_EXIT_MARGIN + 1)
    tick()
    expect(state(wild)).toBe('chase')

    movePlayer(RETALIATE_LEASH_RADIUS + 1)
    tick()
    expect(state(wild)).toBe('wander')
  })

  it('sem ninguém do lado do jogador na luta (treinador a 0 de HP), quem perseguia volta a vagar', () => {
    const { wild, player, tick, movePlayer } = setup()
    movePlayer(AGGRO_RADIUS - 1)
    tick()
    player.set(Vitals, { hp: 0 })

    tick()

    expect(state(wild)).toBe('wander')
    expect(wild.get(WildBehavior).target).toBe(null)
  })
})

describe('wildBehaviorSystem — pacífica', () => {
  it('jogador bem perto não faz ela perseguir', () => {
    const { wild, tick, movePlayer } = setup({ temperament: 'peaceful' })
    movePlayer(2)

    tick()
    tick()

    expect(state(wild)).toBe('wander')
  })

  it('fugindo, corre pra longe do jogador', () => {
    const { wild, tick, movePlayer } = setup({ temperament: 'peaceful' })
    movePlayer(3)
    fugirDoJogador(wild)

    // Começa virada pro jogador; o giro é suave, então dá 1s pra virar.
    for (let i = 0; i < 60; i++) tick()

    const vel = wild.get(Velocity)
    expect(vel.z).toBeLessThan(0) // jogador em +Z, foge pra -Z
    expect(Math.hypot(vel.x, vel.z)).toBeCloseTo(SPECIES.movement.runSpeed)
  })

  it('fugindo, ao passar de FLEE_SAFE_DISTANCE volta a vagar', () => {
    const { wild, tick, movePlayer } = setup({ temperament: 'peaceful' })
    fugirDoJogador(wild)

    movePlayer(FLEE_SAFE_DISTANCE - 1)
    tick()
    expect(state(wild)).toBe('flee')

    movePlayer(FLEE_SAFE_DISTANCE + 1)
    tick()
    expect(state(wild)).toBe('wander')
  })
})

describe('wildBehaviorSystem — atacando e gastando fôlego', () => {
  // charmander: scratch com range 1 (override), radius 0.3; alvo com o
  // mesmo corpo (raio 0.3) → alcance 1.6m centro a centro.
  const scratch = resolveCreatureAttack(SPECIES.attacks.primary)
  const REACH = scratch.range + scratch.radius + SPECIES.body.capsuleRadius

  it('perseguindo com o alvo ao alcance: pede golpe e respeita o intervalo', () => {
    const { wild, player, tick, movePlayer } = setup()
    movePlayer(REACH - 0.2)

    tick() // decide perseguir
    tick() // ao alcance: pede
    expect(wild.has(WantsToAttack)).toBe(true)
    // O pedido leva o alvo (o creatureAttackSystem mira nele).
    expect(wild.get(WantsToAttack).target).toBe(player)

    wild.remove(WantsToAttack) // o creatureAttackSystem consome
    tick()
    expect(wild.has(WantsToAttack)).toBe(false) // intervalo ainda correndo

    for (let t = 0; t < ATTACK_INTERVAL; t += DELTA) tick()
    expect(wild.has(WantsToAttack)).toBe(true)
  })

  it('fora do alcance não pede golpe — corre até lá', () => {
    const { wild, tick, movePlayer } = setup()
    movePlayer(REACH + 2)

    tick()
    tick()

    expect(wild.has(WantsToAttack)).toBe(false)
    expect(
      Math.hypot(wild.get(Velocity).x, wild.get(Velocity).z),
    ).toBeGreaterThan(0)
  })

  it('com golpe em andamento, fica parada', () => {
    const { wild, tick, movePlayer } = setup()
    movePlayer(REACH + 2)
    tick()
    wild.set(ActionState, { current: 'attack' })

    tick()

    expect(wild.get(Velocity)).toMatchObject({ x: 0, z: 0 })
  })

  it('perseguir correndo gasta stamina', () => {
    const { wild, tick, movePlayer } = setup()
    movePlayer(AGGRO_RADIUS - 1)
    tick()
    const before = wild.get(Vitals).stamina

    for (let i = 0; i < 30; i++) tick()

    expect(wild.get(Vitals).stamina).toBeLessThan(before)
  })

  it('sem stamina, persegue andando (walkSpeed) em vez de correr', () => {
    const { wild, tick, movePlayer } = setup()
    movePlayer(AGGRO_RADIUS - 1)
    tick()
    wild.set(Vitals, { stamina: 0 })

    tick()

    const vel = wild.get(Velocity)
    expect(Math.hypot(vel.x, vel.z)).toBeCloseTo(SPECIES.movement.walkSpeed)
  })

  it('fugir correndo também gasta stamina', () => {
    const { wild, tick, movePlayer } = setup({ temperament: 'peaceful' })
    movePlayer(3)
    fugirDoJogador(wild)
    const before = wild.get(Vitals).stamina

    for (let i = 0; i < 30; i++) tick()

    expect(wild.get(Vitals).stamina).toBeLessThan(before)
  })
})

describe('selvagem hostil de ponta a ponta (comportamento + ataque)', () => {
  it('persegue o treinador no controle e tira vida dele com golpes', () => {
    const world = createWorld()
    worlds.push(world)
    const events = createEventQueue()
    // Sem física, a selvagem não anda de verdade: o treinador já está
    // dentro do alcance do golpe dela (1.2m), e o teste cobre decidir
    // perseguir + pedir golpe + o golpe acertar.
    const trainer = world.spawn(
      InputControlled,
      Party,
      Position({ x: 30, y: 0.45, z: 31.2 }),
      Rotation,
      CharacterController(getPlayerSpecies().body),
      Vitals,
    )
    world.spawn(
      WildCreature({ speciesId: 'charmander' }),
      WildBehavior({ temperament: 'hostile' }),
      Position(WILD_AT),
      Rotation,
      Velocity,
      MovementStats(SPECIES.movement),
      CharacterController(SPECIES.body),
      PhysicsBody,
      PathState,
      WanderState({ homeX: WILD_AT.x, homeZ: WILD_AT.z }),
      Mood,
      ActionState,
      AttackCooldowns,
      IndividualValues,
      vitalsFromSpecies(SPECIES),
    )
    const hpBefore = trainer.get(Vitals).hp

    for (let i = 0; i < 180; i++) {
      events.beginStep()
      creatureAttackSystem({ world, delta: DELTA, input: {}, events })
      wildBehaviorSystem({ world, delta: DELTA })
    }

    expect(trainer.get(Vitals).hp).toBeLessThan(hpBefore)
  })
})

describe('wildBehaviorSystem — alvo por ameaça ou proximidade', () => {
  // Criatura do time (fora do controle) perto da selvagem.
  function spawnPartyCreature(world, distance) {
    return world.spawn(
      SummonedCreature({ slot: 'slot1', speciesId: 'charmander' }),
      Position({ x: 30, y: 0.45, z: 30 - distance }),
      CharacterController(SPECIES.body),
      vitalsFromSpecies(SPECIES),
    )
  }
  const target = (wild) => wild.get(WildBehavior).target

  it('sem ameaça, persegue o mais perto do lado do jogador (não só quem está no controle)', () => {
    const { world, wild, player, tick, movePlayer } = setup()
    movePlayer(AGGRO_RADIUS - 1)
    const creature = spawnPartyCreature(world, 2)

    tick()

    expect(state(wild)).toBe('chase')
    expect(target(wild)).toBe(creature)
    expect(target(wild)).not.toBe(player)
  })

  it('com ameaça, persegue quem mais causou dano nela, mesmo mais longe', () => {
    const { world, wild, player, tick, movePlayer } = setup()
    movePlayer(AGGRO_RADIUS - 1)
    const creature = spawnPartyCreature(world, 2)
    registrarAmeaca(wild, player, 10)
    perseguirJogador(wild, { provoked: true })

    tick()
    expect(target(wild)).toBe(player)

    // A criatura passa a causar mais dano: vira o alvo.
    registrarAmeaca(wild, creature, 15)
    tick()
    expect(target(wild)).toBe(creature)
  })

  it('quem saiu da luta (desmaiou) não é alvo, mesmo no topo da ameaça', () => {
    const { world, wild, player, tick, movePlayer } = setup()
    movePlayer(AGGRO_RADIUS - 1)
    const creature = spawnPartyCreature(world, 2)
    registrarAmeaca(wild, creature, 50)
    perseguirJogador(wild, { provoked: true })
    creature.add(Fainted)

    tick()

    expect(target(wild)).toBe(player)
  })

  it('voltar a vagar zera a ameaça (a luta acabou)', () => {
    const { wild, player } = setup()
    registrarAmeaca(wild, player, 10)
    expect(wild.get(Threat).entries).toHaveLength(1)

    voltarAVagar(wild, wild.get(Position))

    expect(wild.get(Threat).entries).toEqual([])
  })
})
