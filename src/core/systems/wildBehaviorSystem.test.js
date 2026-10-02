import { afterEach, describe, expect, it } from 'vitest'
import { createWorld } from 'koota'
import {
  fugirDoJogador,
  perseguirJogador,
  registrarAmeaca,
  voltarAVagar,
} from '../actions/wildBehavior'
import { resolveSpeedMultiplier } from '../actions/movementSpeed'
import { resolveCreatureAttack } from '../battle/creatureAttack'
import { getPlayerSpecies, getSpecies } from '../data/species'
import { GAME_CONFIG } from '../gameConfig'
import {
  AiMovement,
  ActionState,
  AttackCooldowns,
  CharacterController,
  CombatMode,
  Fainted,
  InputControlled,
  Mood,
  MovementBlocked,
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

// Habilidades travadas em cooldown: a selvagem só tem o básico — os testes
// de distância/intervalo não dependem do sorteio do golpe.
const SKILLS_LOCKED = { secondary1: 999, secondary2: 999, secondary3: 999 }

function setup({ temperament = 'hostile', playerAt, skills = false } = {}) {
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
    AiMovement,
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
    AttackCooldowns(skills ? {} : SKILLS_LOCKED),
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

  it('perto o bastante (vão entre os corpos ≤ CHASE_STOP_GAP), com o golpe pronto: para e encara o jogador', () => {
    const { wild, tick, movePlayer } = setup()
    const touching = SPECIES.body.capsuleRadius * 2 + CHASE_STOP_GAP / 2
    movePlayer(touching)
    wild.set(Rotation, { y: Math.PI }) // de costas pro jogador

    tick() // decide perseguir; perto e o intervalo vencido: para, gira e pede

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

  it('fugindo ferida, corre mais devagar (dá pra alcançar)', () => {
    const { wild, tick, movePlayer } = setup({ temperament: 'peaceful' })
    movePlayer(3)
    fugirDoJogador(wild)
    wild.set(Vitals, { hp: wild.get(Vitals).maxHp * 0.25 })
    const factor = resolveSpeedMultiplier(wild.get(Vitals))

    for (let i = 0; i < 60; i++) tick()

    const vel = wild.get(Velocity)
    expect(Math.hypot(vel.x, vel.z)).toBeCloseTo(
      SPECIES.movement.runSpeed * factor,
    )
  })

  it('fugindo encostada na parede: escolhe destino andável e não corre contra ela', () => {
    const { wild, player, tick } = setup({ temperament: 'peaceful' })
    // Parede em x = 75; quem persegue a oeste dela.
    wild.set(Position, { x: 72, y: 0.45, z: 0 })
    player.set(Position, { x: 66, y: 0.45, z: 0 })
    fugirDoJogador(wild)

    for (let i = 0; i < 60; i++) tick()

    const behavior = wild.get(WildBehavior)
    expect(behavior.hasFleePoint).toBe(true)
    expect(behavior.fleeX).toBeLessThan(75)
    // Não está empurrando pra dentro da parede (+X).
    expect(wild.get(Velocity).x).toBeLessThan(SPECIES.movement.runSpeed * 0.5)
  })

  it('fugindo e travou (MovementBlocked): escolhe outro destino na hora', () => {
    const { wild, tick, movePlayer } = setup({ temperament: 'peaceful' })
    movePlayer(3)
    fugirDoJogador(wild)
    tick()
    // Destino falso, longe; travando, é refeito sem esperar o intervalo.
    wild.set(WildBehavior, { fleeX: 0, fleeZ: 0, fleeTimer: 99 })
    wild.add(MovementBlocked)

    tick()

    expect(wild.get(WildBehavior).fleeX).not.toBe(0)
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
  // charmander: tackle com range 1 (override), radius 0.3; alvo com o
  // mesmo corpo (raio 0.3) → alcance 1.6m centro a centro.
  const tackle = resolveCreatureAttack(SPECIES, 'primary')
  const REACH = tackle.range + tackle.radius + SPECIES.body.capsuleRadius

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

  it('de lado pro alvo (vinha rodeando): vira pra ele antes de pedir o golpe', () => {
    const { wild, tick, movePlayer } = setup()
    // Dentro da distância de parada: nem aproximando, nem rodeando.
    movePlayer(REACH * 0.5)
    wild.set(Rotation, { y: Math.PI / 2 }) // de lado (alvo em +Z, yaw 0)

    tick()
    expect(wild.has(WantsToAttack)).toBe(false)
    expect(wild.get(AiMovement).mode).toBe('aim')

    for (let i = 0; i < 30 && !wild.has(WantsToAttack); i++) tick()
    expect(wild.has(WantsToAttack)).toBe(true)
    expect(Math.abs(wild.get(Rotation).y)).toBeLessThanOrEqual(
      GAME_CONFIG.AI_MOVEMENT.AIM_TOLERANCE,
    )
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
      AiMovement,
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
      AttackCooldowns(SKILLS_LOCKED),
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
    const { world, wild, tick, movePlayer } = setup()
    movePlayer(AGGRO_RADIUS + 20) // o treinador fora da história
    const far = spawnPartyCreature(world, AGGRO_RADIUS - 1)
    const near = spawnPartyCreature(world, 2)
    registrarAmeaca(wild, far, 10)
    perseguirJogador(wild, { provoked: true })

    tick()
    expect(target(wild)).toBe(far)

    // A mais perto passa a causar mais dano: vira o alvo.
    registrarAmeaca(wild, near, 15)
    tick()
    expect(target(wild)).toBe(near)
  })

  it('treinador só é alvo se for o ÚNICO do lado do jogador no raio dela', () => {
    const { world, wild, player, tick, movePlayer } = setup()
    movePlayer(2)
    registrarAmeaca(wild, player, 50) // topo da ameaça
    perseguirJogador(wild, { provoked: true })
    const creature = spawnPartyCreature(world, 5)

    tick()
    expect(target(wild)).toBe(creature)

    // A criatura sai do raio: sobra o treinador.
    creature.set(Position, { x: 30, y: 0.45, z: 30 - 40 })
    tick()
    expect(target(wild)).toBe(player)
  })

  it('hostil vagando: com criatura do time no raio, não aggra no treinador', () => {
    const { world, wild, tick, movePlayer } = setup()
    movePlayer(2)
    const creature = spawnPartyCreature(world, AGGRO_RADIUS - 1)

    tick()

    expect(state(wild)).toBe('chase')
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

describe('wildBehaviorSystem — habilidades (escolha do golpe)', () => {
  it('a 6m, com só o Ember pronto, para e pede o Ember de longe', () => {
    const { wild, tick, movePlayer } = setup({ skills: true })
    wild.set(AttackCooldowns, { secondary1: 999, secondary2: 999 })
    movePlayer(6)

    tick() // decide perseguir, planeja e já pede (alvo ao alcance)

    expect(wild.get(WantsToAttack)?.slot).toBe('secondary3')
    expect(Math.hypot(wild.get(Velocity).x, wild.get(Velocity).z)).toBe(0)
    // Pedido feito: o plano é refeito no próximo golpe; o debug guarda o último.
    expect(wild.get(WildBehavior)).toMatchObject({
      attackSlot: null,
      lastAttackSlot: 'secondary3',
    })
  })

  it('golpe planejado que alcança menos: corre até o alcance DELE', () => {
    const { wild, tick, movePlayer } = setup({ skills: true })
    wild.set(AttackCooldowns, { secondary1: 999, secondary3: 999 })
    movePlayer(6)

    tick()
    tick()

    // O Tackle (E) ganha do básico (40 × 5): corre até ele, sem pedir ainda.
    expect(wild.get(WildBehavior).attackSlot).toBe('secondary2')
    expect(wild.has(WantsToAttack)).toBe(false)
    expect(
      Math.hypot(wild.get(Velocity).x, wild.get(Velocity).z),
    ).toBeGreaterThan(0)
  })

  it('trocar de alvo descarta o golpe planejado', () => {
    const { wild, world, tick, movePlayer } = setup({ skills: true })
    wild.set(AttackCooldowns, { secondary1: 999, secondary3: 999 })
    movePlayer(6)
    tick() // decide perseguir
    // Plano no básico (sempre pronto): mantido enquanto o alvo não muda.
    wild.set(WildBehavior, { attackSlot: 'primary' })
    tick()
    expect(wild.get(WildBehavior).attackSlot).toBe('primary')

    // Alguém do lado do jogador bem mais perto vira o alvo: o plano é refeito
    // (e o Tackle ganha do básico).
    world.spawn(
      SummonedCreature({ slot: 'slot1', speciesId: 'charmander' }),
      Position({ x: 30, y: 0.45, z: 27 }),
      CharacterController(SPECIES.body),
      vitalsFromSpecies(SPECIES),
    )
    tick()
    expect(wild.get(WildBehavior).attackSlot).toBe('secondary2')
  })

  it('energia baixa: descansa — sem golpe e sem correr até recuperar', () => {
    const { wild, tick, movePlayer } = setup({ skills: true })
    const { maxStamina } = wild.get(Vitals)
    const { REST_ENTER_FRACTION, REST_EXIT_FRACTION } = GAME_CONFIG.AI_ENERGY
    wild.set(Vitals, { stamina: REST_ENTER_FRACTION * maxStamina })
    movePlayer(1.4) // ao alcance do básico (1.6m)

    tick()

    expect(wild.get(WildBehavior).resting).toBe(true)
    expect(wild.has(WantsToAttack)).toBe(false)
    expect(
      Math.hypot(wild.get(Velocity).x, wild.get(Velocity).z),
    ).toBeLessThanOrEqual(SPECIES.movement.walkSpeed + 1e-6)

    // Recuperou até o limite de saída: volta a lutar.
    wild.set(Vitals, { stamina: REST_EXIT_FRACTION * maxStamina })
    tick()
    expect(wild.get(WildBehavior).resting).toBe(false)
    expect(
      wild.get(WildBehavior).lastAttackSlot ??
        wild.get(WildBehavior).attackSlot,
    ).not.toBeNull()
  })
})

describe('wildBehaviorSystem — movimento na luta', () => {
  it('dash em andamento: segue nele (velocidade do dash, a ação avança)', () => {
    const { wild, tick, movePlayer } = setup()
    movePlayer(6)
    tick() // decide perseguir
    wild.set(ActionState, { current: 'dash', elapsed: 0, dirX: 1, dirZ: 0 })

    tick()

    expect(wild.get(Velocity).x).toBeCloseTo(
      GAME_CONFIG.PLAYER_ACTIONS.dash.SPEED,
    )
    expect(wild.get(ActionState).elapsed).toBeCloseTo(DELTA)
  })

  it('desviando de um golpe, não pede o seu (mesmo ao alcance)', () => {
    const { world, wild, tick, movePlayer } = setup()
    movePlayer(20) // o treinador longe
    // Uma criatura do time colada nela, carregando o básico em cima dela.
    const mine = world.spawn(
      SummonedCreature({ slot: 'slot1', speciesId: 'charmander' }),
      Position({ x: 30, y: 0.45, z: 31.2 }),
      CharacterController(SPECIES.body),
      ActionState({
        current: 'attack',
        pendingSlot: 'primary',
        elapsed: 0.25,
        animationSpeed: 1 / resolveCreatureAttack(SPECIES, 'primary').duration,
        dirX: 0,
        dirZ: -1,
      }),
      IndividualValues,
      vitalsFromSpecies(SPECIES),
    )
    perseguirJogador(wild, { provoked: true })
    // Sorteio do desvio já feito (reage).
    wild.set(AiMovement, { dodgeAttacker: mine, dodgeReact: true })

    tick()

    expect(wild.get(WildBehavior).target).toBe(mine)
    expect(wild.get(AiMovement).mode).toBe('dodge')
    expect(wild.has(WantsToAttack)).toBe(false)
  })

  it('no alcance esperando o intervalo: rodeia o alvo', () => {
    const { wild, tick, movePlayer } = setup()
    movePlayer(1.2)
    tick() // pede o golpe (intervalo começa)
    wild.remove(WantsToAttack)

    tick()

    expect(wild.get(AiMovement).mode).toBe('strafe')
    expect(
      Math.hypot(wild.get(Velocity).x, wild.get(Velocity).z),
    ).toBeGreaterThan(0)
  })
})

describe('wildBehaviorSystem — decisões com critério', () => {
  const WB = GAME_CONFIG.WILD_BEHAVIOR
  /** Roda `fn` com valores trocados em `WILD_BEHAVIOR` (sorteio fixo). */
  function withConfig(overrides, fn) {
    const saved = Object.fromEntries(
      Object.keys(overrides).map((key) => [key, WB[key]]),
    )
    Object.assign(WB, overrides)
    try {
      fn()
    } finally {
      Object.assign(WB, saved)
    }
  }
  const setHp = (wild, fraction) =>
    wild.set(Vitals, { hp: fraction * wild.get(Vitals).maxHp })

  it('perseguindo e chegando na vida baixa: foge (sorteio) e fica abalada', () => {
    withConfig({ LOW_HP_FLEE_CHANCE: 1 }, () => {
      const { wild, tick, movePlayer } = setup()
      movePlayer(3)
      tick() // persegue
      setHp(wild, WB.LOW_HP_FLEE_FRACTION)

      tick()

      expect(wild.get(WildBehavior)).toMatchObject({
        state: 'flee',
        shaken: true,
        lowHpRolled: true,
      })
    })
  })

  it('abalada não volta a perseguir (nem hostil no raio) até se recuperar', () => {
    withConfig({ LOW_HP_FLEE_CHANCE: 1 }, () => {
      const { wild, tick, movePlayer } = setup()
      movePlayer(3)
      tick()
      setHp(wild, WB.LOW_HP_FLEE_FRACTION)
      tick() // foge
      movePlayer(WB.FLEE_SAFE_DISTANCE + 1)
      tick() // longe: volta a vagar, ainda abalada
      expect(state(wild)).toBe('wander')

      movePlayer(3) // dentro do raio de aggro
      tick()
      expect(state(wild)).toBe('wander')

      setHp(wild, WB.LOW_HP_RECOVER_FRACTION) // recuperou
      tick()
      expect(wild.get(WildBehavior).shaken).toBe(false)
      tick()
      expect(state(wild)).toBe('chase')
    })
  })

  it('sorteio UMA vez por queda: decidiu lutar, não sorteia de novo', () => {
    const { wild, tick, movePlayer } = setup()
    movePlayer(3)
    tick()
    withConfig({ LOW_HP_FLEE_CHANCE: 0 }, () => {
      setHp(wild, WB.LOW_HP_FLEE_FRACTION)
      tick()
    })
    expect(wild.get(WildBehavior)).toMatchObject({
      state: 'chase',
      lowHpRolled: true,
    })
    withConfig({ LOW_HP_FLEE_CHANCE: 1 }, () => tick())
    expect(state(wild)).toBe('chase')
  })

  it('a ameaça cai pela metade a cada THREAT_HALF_LIFE e some abaixo do mínimo', () => {
    const { wild, player, world } = setup()
    const other = world.spawn(Position({ x: 0, y: 0, z: 0 }))
    registrarAmeaca(wild, player, 40)
    registrarAmeaca(wild, other, WB.THREAT_MIN * 1.5)

    wildBehaviorSystem({ world, delta: WB.THREAT_HALF_LIFE })

    const entries = wild.get(Threat).entries
    expect(entries).toHaveLength(1)
    expect(entries[0].amount).toBeCloseTo(20)
  })
})
