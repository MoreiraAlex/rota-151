import { afterEach, describe, expect, it } from 'vitest'
import { makeWorld } from '@/test/makeWorld'
import { desmaiar } from '../actions/faint'
import { defenderGrupo } from '../actions/partyBehavior'
import { perseguirJogador } from '../actions/wildBehavior'
import { resolveCreatureAttack } from '../battle/creatureAttack'
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
  AiMovement,
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

const SLOTS = ['secondary1', 'secondary2', 'secondary3']
// Um golpe corpo a corpo de dano do kit (sem fixar qual).
const MELEE_SLOT = SLOTS.find((slot) => {
  const attack = resolveCreatureAttack(CHARMANDER, slot)
  return attack?.damage && attack.aim === 'melee' && !attack.damageMode
})
// Só o golpe corpo a corpo pronto (os outros travados em cooldown) — os testes
// de distância/intervalo não dependem do sorteio do golpe.
const SKILLS_LOCKED = Object.fromEntries(
  SLOTS.filter((slot) => slot !== MELEE_SLOT).map((slot) => [slot, 999]),
)

/** Criatura do time como o `summonBallSystem` cria (fora do controle). */
function spawnPartyCreature(
  world,
  position,
  slot = 'slot1',
  { skills = false } = {},
) {
  return world.spawn(
    SummonedCreature({ slot, speciesId: 'charmander' }),
    PartyBehavior,
    AiMovement,
    Position(position),
    Rotation,
    Velocity,
    MovementStats(CHARMANDER.movement),
    CharacterController(CHARMANDER.body),
    PhysicsBody,
    PathState,
    ActionState,
    AttackCooldowns(skills ? {} : SKILLS_LOCKED),
    IndividualValues,
    Mood,
    vitalsFromSpecies(CHARMANDER),
  )
}

function spawnWild(world, position, { skills = false } = {}) {
  return world.spawn(
    WildCreature({ speciesId: 'charmander' }),
    WildBehavior({ temperament: 'hostile' }),
    AiMovement,
    Position(position),
    Rotation,
    Velocity,
    MovementStats(CHARMANDER.movement),
    CharacterController(CHARMANDER.body),
    PhysicsBody,
    PathState,
    WanderState({ homeX: position.x, homeZ: position.z }),
    ActionState,
    AttackCooldowns(skills ? {} : SKILLS_LOCKED),
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
    attackId: 'tackle',
    slot: MELEE_SLOT,
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
  const melee = resolveCreatureAttack(CHARMANDER, MELEE_SLOT)
  const REACH = melee.range + melee.radius + CHARMANDER.body.capsuleRadius

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

  it('de lado pra selvagem: vira pra ela antes de pedir o golpe', () => {
    const { world } = setup()
    const mine = spawnPartyCreature(world, at(0, 3))
    // Dentro da distância de parada, em +Z (yaw 0).
    const wild = spawnWild(world, at(0, 3 + REACH * 0.5))
    defenderGrupo(mine, wild)
    mine.set(Rotation, { y: Math.PI / 2 })

    tick(world)
    expect(mine.has(WantsToAttack)).toBe(false)
    expect(mine.get(AiMovement).mode).toBe('aim')

    for (let i = 0; i < 30 && !mine.has(WantsToAttack); i++) tick(world)
    expect(mine.has(WantsToAttack)).toBe(true)
    expect(Math.abs(mine.get(Rotation).y)).toBeLessThanOrEqual(
      GAME_CONFIG.AI_MOVEMENT.AIM_TOLERANCE,
    )
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
  it('selvagem hostil perto do grupo bate na criatura (não no treinador), que entra na luta e tira vida dela', () => {
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

    // Com a criatura do time ali, o treinador não é alvo (Parte 4).
    expect(trainer.get(Vitals).hp).toBe(trainerHpBefore)
    expect(mine.get(Vitals).hp).toBeLessThan(mine.get(Vitals).maxHp)
    expect(stateOf(mine).state).toBe('fight')
    expect(wild.get(Vitals).hp).toBeLessThan(wildHpBefore)
  })
})

describe('partyBehaviorSystem — habilidades (escolha do golpe)', () => {
  function tick(world) {
    partyBehaviorSystem({ world, delta: DELTA })
    creatureFollowSystem({ world, delta: DELTA })
  }

  it('a 6m, com só o Ember pronto, para e pede o Ember de longe', () => {
    const { world } = setup()
    const mine = spawnPartyCreature(world, at(0, 3), 'slot1', { skills: true })
    mine.set(AttackCooldowns, { secondary1: 999, secondary2: 999 })
    const wild = spawnWild(world, at(0, 9))
    defenderGrupo(mine, wild)

    tick(world)

    expect(mine.get(WantsToAttack)).toMatchObject({
      target: wild,
      slot: 'secondary3',
    })
    expect(Math.hypot(mine.get(Velocity).x, mine.get(Velocity).z)).toBe(0)
    expect(stateOf(mine)).toMatchObject({
      attackSlot: null,
      lastAttackSlot: 'secondary3',
    })
  })

  it('golpe planejado que alcança menos: corre até o alcance DELE', () => {
    const { world } = setup()
    const mine = spawnPartyCreature(world, at(0, 3), 'slot1', { skills: true })
    mine.set(AttackCooldowns, { secondary1: 999, secondary3: 999 })
    const wild = spawnWild(world, at(0, 9))
    defenderGrupo(mine, wild)

    tick(world)

    expect(stateOf(mine).attackSlot).toBe('secondary2')
    expect(mine.has(WantsToAttack)).toBe(false)
    expect(mine.get(Velocity).z).toBeGreaterThan(0)
  })

  it('entrar na luta (ou trocar de alvo) descarta o golpe planejado', () => {
    const { world } = setup()
    const mine = spawnPartyCreature(world, at(0, 3))
    mine.set(PartyBehavior, { attackSlot: 'secondary2' })

    defenderGrupo(mine, spawnWild(world, at(0, 9)))

    expect(stateOf(mine).attackSlot).toBeNull()
  })

  it('de ponta a ponta: a criatura do time usa habilidade e tira vida da selvagem', () => {
    const { world } = setup()
    const mine = spawnPartyCreature(world, at(1.2, 1.2), 'slot1', {
      skills: true,
    })
    const wild = spawnWild(world, at(0, 1.2))
    const wildHpBefore = wild.get(Vitals).hp
    const used = new Set()
    const events = createEventQueue()

    for (let i = 0; i < 600; i++) {
      events.beginStep()
      const ctx = { world, delta: DELTA, input: {}, events }
      creatureAttackSystem(ctx)
      partyBehaviorSystem(ctx)
      creatureFollowSystem(ctx)
      wildBehaviorSystem(ctx)
      wildReactionSystem(ctx)
      partyReactionSystem(ctx)
      const last = stateOf(mine).lastAttackSlot
      if (last) used.add(last)
    }

    expect(mine.get(Vitals).hp).toBeLessThan(mine.get(Vitals).maxHp)
    expect(wild.get(Vitals).hp).toBeLessThan(wildHpBefore)
    expect(used.size).toBeGreaterThan(0)
  })

  it('energia baixa: descansa — sem golpe e sem correr até recuperar', () => {
    const { world } = setup()
    const mine = spawnPartyCreature(world, at(0, 3), 'slot1', { skills: true })
    const wild = spawnWild(world, at(0, 4.2)) // ao alcance do básico
    defenderGrupo(mine, wild)
    const { maxStamina } = mine.get(Vitals)
    const { REST_ENTER_FRACTION, REST_EXIT_FRACTION } = GAME_CONFIG.AI_ENERGY
    mine.set(Vitals, { stamina: REST_ENTER_FRACTION * maxStamina })

    tick(world)
    expect(stateOf(mine).resting).toBe(true)
    expect(mine.has(WantsToAttack)).toBe(false)

    mine.set(Vitals, { stamina: REST_EXIT_FRACTION * maxStamina })
    tick(world)
    expect(stateOf(mine).resting).toBe(false)
    expect(mine.has(WantsToAttack)).toBe(true)
  })
})

describe('partyBehaviorSystem — movimento na luta', () => {
  function tick(world) {
    partyBehaviorSystem({ world, delta: DELTA })
    creatureFollowSystem({ world, delta: DELTA })
  }

  it('no alcance esperando o intervalo: rodeia a selvagem', () => {
    const { world } = setup()
    const mine = spawnPartyCreature(world, at(0, 3))
    const wild = spawnWild(world, at(0, 4.2))
    defenderGrupo(mine, wild)
    tick(world) // pede o golpe (intervalo começa)
    mine.remove(WantsToAttack)

    tick(world)

    expect(mine.get(AiMovement).mode).toBe('strafe')
    expect(
      Math.hypot(mine.get(Velocity).x, mine.get(Velocity).z),
    ).toBeGreaterThan(0)
  })

  it('dash em andamento: segue nele, sem o follow puxar de volta', () => {
    const { world } = setup()
    const mine = spawnPartyCreature(world, at(0, 3))
    defenderGrupo(mine, spawnWild(world, at(0, 9)))
    mine.set(ActionState, { current: 'dash', elapsed: 0, dirX: 0, dirZ: 1 })

    tick(world)

    expect(mine.get(Velocity).z).toBeCloseTo(
      GAME_CONFIG.PLAYER_ACTIONS.dash.SPEED,
    )
  })
})

describe('partyBehaviorSystem — decisões com critério', () => {
  it('alvo saiu da luta: troca pra selvagem com MENOS vida (não a mais perto)', () => {
    const { world } = setup()
    const mine = spawnPartyCreature(world, at(0, 3))
    // Lutando com outra criatura do time (não com o treinador — esse é o
    // caso de proteger, outro teste).
    const other = spawnPartyCreature(world, at(-2, 3), 'slot2')
    const first = spawnWild(world, at(0, 5))
    const near = spawnWild(world, at(1, 4))
    const weak = spawnWild(world, at(4, 6))
    for (const wild of [near, weak]) {
      perseguirJogador(wild, { provoked: true })
      wild.set(WildBehavior, { target: other })
    }
    weak.set(Vitals, { hp: weak.get(Vitals).maxHp * 0.2 })
    defenderGrupo(mine, first)

    desmaiar(world, first)
    partyBehaviorSystem({ world, delta: DELTA })

    expect(stateOf(mine).target).toBe(weak)
  })
})

describe('partyBehaviorSystem — protege o treinador', () => {
  it('lutando com uma selvagem, troca pra que está mirando o treinador', () => {
    const { world, trainer } = setup()
    const mine = spawnPartyCreature(world, at(0, 3))
    const other = spawnPartyCreature(world, at(-2, 3), 'slot2')
    const busy = spawnWild(world, at(0, 5))
    perseguirJogador(busy, { provoked: true })
    busy.set(WildBehavior, { target: other })
    const hunter = spawnWild(world, at(3, 0))
    perseguirJogador(hunter, { provoked: true })
    hunter.set(WildBehavior, { target: trainer })
    defenderGrupo(mine, busy)

    partyBehaviorSystem({ world, delta: DELTA })

    expect(stateOf(mine).target).toBe(hunter)
  })
})
