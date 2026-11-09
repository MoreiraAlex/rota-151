import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { resolveReachFor } from '@/core/battle/aiAttackChoice'
import { resolveHitTrigger } from '@/core/battle/hitTrigger'
import { givePokemon, makeWorld, ownedByPlayer } from '@/test/makeWorld'
import { desmaiar } from '../actions/faint'
import { defenderGrupo } from '../actions/partyBehavior'
import { definirPostura } from '../actions/posture'
import {
  perceberJogador,
  perseguirJogador,
  sairDoMapa,
  voltarAVagar,
} from '../actions/wildBehavior'
import { resolveCreatureAttack } from '../battle/creatureAttack'
import { getSpecies } from '../data/species'
import { attackResolved, createEventQueue } from '../events'
import { GAME_CONFIG } from '../gameConfig'
import {
  ActionState,
  AttackCooldowns,
  BeingCaptured,
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
  SummonedFrom,
  Training,
  Velocity,
  Vitals,
  WantsToAttack,
  WanderState,
  WildAwareness,
  WildBehavior,
  WildCreature,
  vitalsFromSpecies,
} from '../traits'
import { creatureAttackSystem } from './creatureAttackSystem'
import { creatureFollowSystem } from './creatureFollowSystem'
import { partyBehaviorSystem } from './partyBehaviorSystem'
import { partyReactionSystem } from './partyReactionSystem'
import { wildAwarenessSystem } from './wildAwarenessSystem'
import { wildBehaviorSystem } from './wildBehaviorSystem'
import { wildReactionSystem } from './wildReactionSystem'

// A IA de hoje (034) é a dificuldade máxima das selvagens (063) e do time
// (064): estes testes conferem o comportamento na ponta difícil.
const originalDifficulty = GAME_CONFIG.WILD_DIFFICULTY.LEVEL
const originalPartyDifficulty = GAME_CONFIG.PARTY_DIFFICULTY.LEVEL
beforeAll(() => {
  GAME_CONFIG.WILD_DIFFICULTY.LEVEL = 1
  GAME_CONFIG.PARTY_DIFFICULTY.LEVEL = 1
})
afterAll(() => {
  GAME_CONFIG.WILD_DIFFICULTY.LEVEL = originalDifficulty
  GAME_CONFIG.PARTY_DIFFICULTY.LEVEL = originalPartyDifficulty
})

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
  return (
    attack?.damage && attack.aim === 'melee' && attack.execution !== 'channel'
  )
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
    ...ownedByPlayer(world),
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
    WildAwareness,
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

describe('partyReactionSystem — defensiva (a padrão)', () => {
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
  const TRIGGER = resolveHitTrigger(CHARMANDER.body)
  const REACH = resolveReachFor(melee, TRIGGER, TRIGGER)

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
      wildAwarenessSystem(ctx)
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

  it('dentro do alcance do Ember (longe do corpo a corpo), com só ele pronto, para e pede o Ember de longe', () => {
    const { world } = setup()
    const mine = spawnPartyCreature(world, at(0, 3), 'slot1', { skills: true })
    mine.set(AttackCooldowns, { secondary1: 999, secondary2: 999 })
    // um pouco antes de onde ela pararia pra lançar o Ember
    const trigger = resolveHitTrigger(CHARMANDER.body)
    const ember = resolveCreatureAttack(CHARMANDER, 'secondary3')
    const stop =
      resolveReachFor(ember, trigger, trigger) *
      GAME_CONFIG.PARTY_BEHAVIOR.ATTACK_REACH_FRACTION
    const wild = spawnWild(world, at(0, 3 + stop - 0.2))
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
      wildAwarenessSystem(ctx)
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

// Posturas (docs/features/064-revisao-da-ia-do-parceiro.md, Parte 2).
describe('posturas', () => {
  const { PERCEPTION } = GAME_CONFIG.PARTY_BEHAVIOR
  // Na frente dela (a frente com `Rotation.y` zero é +z), dentro do cone e
  // fora do raio curto — e perto o bastante de quem segue.
  const IN_SIGHT =
    (PERCEPTION.NEAR_RADIUS +
      Math.min(PERCEPTION.VIEW_DISTANCE, LEASH_RADIUS)) /
    2

  /** A criatura do time com um registro na postura dada. */
  function spawnWithPosture(world, trainer, posture, position, slot = 'slot1') {
    const creature = spawnPartyCreature(world, position, slot)
    const pokemon = givePokemon(world, trainer, 'charmander', slot)
    creature.add(SummonedFrom(pokemon))
    definirPostura(pokemon, posture)
    return { creature, pokemon }
  }

  function chase(wild, target) {
    perseguirJogador(wild, { provoked: true })
    wild.set(WildBehavior, { target })
  }

  function decide(world) {
    partyBehaviorSystem({ world, delta: DELTA })
  }

  describe('defensiva', () => {
    it('entra quando uma selvagem parte para cima de alguém do grupo, sem ninguém apanhar', () => {
      const { world, trainer } = setup()
      const { creature } = spawnWithPosture(
        world,
        trainer,
        'defensive',
        at(-2, 0),
      )
      const wild = spawnWild(world, at(3, 3))
      chase(wild, trainer)

      decide(world)

      expect(stateOf(creature)).toMatchObject({ state: 'fight', target: wild })
    })

    it('o alerta ("!") ainda não conta', () => {
      const { world, trainer } = setup()
      const { creature } = spawnWithPosture(
        world,
        trainer,
        'defensive',
        at(-2, 0),
      )
      const wild = spawnWild(world, at(3, 3))
      perceberJogador(wild, trainer)

      decide(world)

      expect(stateOf(creature).state).toBe('follow')
    })

    it('selvagem perseguindo o grupo longe de quem segue (além da coleira) não puxa', () => {
      const { world, trainer } = setup()
      const { creature } = spawnWithPosture(
        world,
        trainer,
        'defensive',
        at(-2, 0),
      )
      const other = spawnPartyCreature(world, at(0, LEASH_RADIUS + 4), 'slot2')
      const wild = spawnWild(world, at(0, LEASH_RADIUS + 6))
      chase(wild, other)

      decide(world)

      expect(stateOf(creature).state).toBe('follow')
    })

    it('não procura briga com a selvagem só à vista', () => {
      const { world, trainer } = setup()
      const { creature } = spawnWithPosture(
        world,
        trainer,
        'defensive',
        at(0, 0),
      )
      spawnWild(world, at(0, IN_SIGHT))

      decide(world)

      expect(stateOf(creature).state).toBe('follow')
    })
  })

  describe('neutra', () => {
    it('não entra quando o treinador ou outra do time apanha', () => {
      const { world, trainer } = setup()
      const { creature } = spawnWithPosture(
        world,
        trainer,
        'neutral',
        at(-2, 0),
      )
      const other = spawnPartyCreature(world, at(-3, 0), 'slot2')
      const wild = spawnWild(world, at(2, 0))
      chase(wild, trainer)

      react(world, [hit(wild, trainer), hit(wild, other)])
      decide(world)

      expect(stateOf(creature).state).toBe('follow')
      expect(stateOf(other).state).toBe('fight')
    })

    it('entra quando ela é acertada, contra quem a acertou', () => {
      const { world, trainer } = setup()
      const { creature } = spawnWithPosture(
        world,
        trainer,
        'neutral',
        at(-2, 0),
      )
      const wild = spawnWild(world, at(2, 0))
      chase(wild, creature)

      react(world, [hit(wild, creature)])
      decide(world)

      expect(stateOf(creature)).toMatchObject({ state: 'fight', target: wild })
    })

    it('não troca para quem mira o treinador', () => {
      const { world, trainer } = setup()
      const { creature } = spawnWithPosture(
        world,
        trainer,
        'neutral',
        at(-2, 0),
      )
      const attacker = spawnWild(world, at(2, 0))
      chase(attacker, creature)
      const hunter = spawnWild(world, at(3, 3))
      chase(hunter, trainer)

      react(world, [hit(attacker, creature)])
      decide(world)

      expect(stateOf(creature).target).toBe(attacker)
    })

    it('quem a atacou saiu da luta: volta a seguir, mesmo com outras brigando com o grupo', () => {
      const { world, trainer } = setup()
      const { creature } = spawnWithPosture(
        world,
        trainer,
        'neutral',
        at(-2, 0),
      )
      const attacker = spawnWild(world, at(2, 0))
      chase(attacker, creature)
      const other = spawnWild(world, at(3, 3))
      chase(other, trainer)
      react(world, [hit(attacker, creature)])
      decide(world)

      voltarAVagar(attacker, attacker.get(Position))
      decide(world)

      expect(stateOf(creature)).toMatchObject({ state: 'follow', target: null })
    })

    it('golpe que erra não conta', () => {
      const { world, trainer } = setup()
      const { creature } = spawnWithPosture(
        world,
        trainer,
        'neutral',
        at(-2, 0),
      )
      const wild = spawnWild(world, at(2, 0))
      chase(wild, creature)

      react(world, [{ ...hit(wild, creature), result: 'miss' }])
      decide(world)

      expect(stateOf(creature).state).toBe('follow')
    })
  })

  describe('agressiva', () => {
    it('entra quando uma selvagem fica dentro da percepção dela, mesmo tranquila', () => {
      const { world, trainer } = setup()
      const { creature } = spawnWithPosture(
        world,
        trainer,
        'aggressive',
        at(0, 0),
      )
      const wild = spawnWild(world, at(0, IN_SIGHT))
      wild.set(WildBehavior, { temperament: 'peaceful' })

      decide(world)

      expect(stateOf(creature)).toMatchObject({ state: 'fight', target: wild })
    })

    it('fora do cone e longe do raio curto, não', () => {
      const { world, trainer } = setup()
      const { creature } = spawnWithPosture(
        world,
        trainer,
        'aggressive',
        at(0, 0),
      )
      spawnWild(world, at(0, -IN_SIGHT))

      decide(world)

      expect(stateOf(creature).state).toBe('follow')
    })

    it('fora da coleira de quem segue, não', () => {
      const { world, trainer } = setup()
      // Ela dentro da coleira; a selvagem no raio curto dela, mas além da
      // coleira do treinador.
      const near = LEASH_RADIUS - PERCEPTION.NEAR_RADIUS * 0.4
      const { creature } = spawnWithPosture(
        world,
        trainer,
        'aggressive',
        at(0, near),
      )
      spawnWild(world, at(0, near + PERCEPTION.NEAR_RADIUS * 0.9))

      decide(world)

      expect(stateOf(creature).state).toBe('follow')
    })

    it('também entra como a defensiva (selvagem partindo para cima, fora da vista)', () => {
      const { world, trainer } = setup()
      const { creature } = spawnWithPosture(
        world,
        trainer,
        'aggressive',
        at(0, 0),
      )
      const wild = spawnWild(world, at(0, -IN_SIGHT))
      chase(wild, trainer)

      decide(world)

      expect(stateOf(creature)).toMatchObject({ state: 'fight', target: wild })
    })

    it('a que treina não entra', () => {
      const { world, trainer } = setup()
      const { creature } = spawnWithPosture(
        world,
        trainer,
        'aggressive',
        at(0, 0),
      )
      creature.add(Training)
      spawnWild(world, at(0, IN_SIGHT))

      decide(world)

      expect(stateOf(creature).state).toBe('follow')
    })
  })

  describe('fora de alvo para qualquer postura', () => {
    it.each(['aggressive', 'defensive'])(
      '%s: não entra contra a selvagem sendo capturada nem a que está fugindo',
      (posture) => {
        const { world, trainer } = setup()
        const { creature } = spawnWithPosture(world, trainer, posture, at(0, 0))
        const captured = spawnWild(world, at(0, IN_SIGHT))
        chase(captured, trainer)
        captured.add(BeingCaptured)
        const leaving = spawnWild(world, at(1, IN_SIGHT))
        chase(leaving, trainer)
        sairDoMapa(leaving, leaving.get(Position), trainer.get(Position))

        decide(world)

        expect(stateOf(creature).state).toBe('follow')
      },
    )

    it('lutando, o alvo começa a ser capturado: larga ele', () => {
      const { world, trainer } = setup()
      const { creature } = spawnWithPosture(
        world,
        trainer,
        'aggressive',
        at(0, 0),
      )
      const wild = spawnWild(world, at(0, IN_SIGHT))
      decide(world)
      expect(stateOf(creature).target).toBe(wild)

      wild.add(BeingCaptured)
      decide(world)

      expect(stateOf(creature)).toMatchObject({ state: 'follow', target: null })
    })
  })

  it('trocar a postura muda na hora: a defensiva lutando pelo treinador, virando neutra, larga', () => {
    const { world, trainer } = setup()
    const { creature, pokemon } = spawnWithPosture(
      world,
      trainer,
      'defensive',
      at(-2, 0),
    )
    const wild = spawnWild(world, at(3, 3))
    chase(wild, trainer)
    decide(world)
    expect(stateOf(creature).state).toBe('fight')

    definirPostura(pokemon, 'neutral')
    decide(world)

    expect(stateOf(creature).state).toBe('follow')
  })
})

// Dificuldade do time (docs/features/064-revisao-da-ia-do-parceiro.md,
// Parte 3).
describe('dificuldade do time', () => {
  afterEach(() => {
    GAME_CONFIG.PARTY_DIFFICULTY.LEVEL = 1
    GAME_CONFIG.WILD_DIFFICULTY.LEVEL = 1
  })

  function attackTimerAfterRequest(world) {
    const mine = spawnPartyCreature(world, at(0, 3))
    const melee = resolveCreatureAttack(CHARMANDER, MELEE_SLOT)
    const trigger = resolveHitTrigger(CHARMANDER.body)
    const wild = spawnWild(
      world,
      at(0, 3 + resolveReachFor(melee, trigger, trigger) - 0.2),
    )
    defenderGrupo(mine, wild)
    partyBehaviorSystem({ world, delta: DELTA })
    expect(mine.get(WantsToAttack)?.target).toBe(wild)
    return stateOf(mine).attackTimer
  }

  it('o ritmo dos golpes segue o PARTY_DIFFICULTY: na ponta fácil, o intervalo dela', () => {
    GAME_CONFIG.PARTY_DIFFICULTY.LEVEL = 0
    const { world } = setup()
    expect(attackTimerAfterRequest(world)).toBeCloseTo(
      GAME_CONFIG.PARTY_DIFFICULTY.EASY.ATTACK_INTERVAL,
    )
  })

  it('a dificuldade das selvagens não muda o ritmo do time', () => {
    GAME_CONFIG.WILD_DIFFICULTY.LEVEL = 0
    const { world } = setup()
    expect(attackTimerAfterRequest(world)).toBeCloseTo(ATTACK_INTERVAL)
  })
})
