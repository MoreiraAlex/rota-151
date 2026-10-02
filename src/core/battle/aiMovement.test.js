import { afterEach, describe, expect, it } from 'vitest'
import { createWorld } from 'koota'
import { getSpecies } from '../data/species'
import { GAME_CONFIG } from '../gameConfig'
import {
  ActionState,
  AiMovement,
  CharacterController,
  DashCooldown,
  Grounded,
  IndividualValues,
  MovementStats,
  PathState,
  PhysicsBody,
  Position,
  Rotation,
  Velocity,
  Vitals,
  WildCreature,
  vitalsFromSpecies,
} from '../traits'
import { resolveDashCost } from '../actions/stamina'
import { resolveAttackForEntity } from './attackCasting'
import { resolveReachFor } from './aiAttackChoice'
import {
  advanceAiDash,
  moveInFight,
  resolveIncomingAttack,
  steerAiBeam,
} from './aiMovement'

const DELTA = 1 / 60
const CHARMANDER = getSpecies('charmander')
const BODY = CHARMANDER.body
const MOVE = GAME_CONFIG.AI_MOVEMENT
const DASH = GAME_CONFIG.PLAYER_ACTIONS.dash
const REACT = () => 0 // sorteio sempre reage
const IGNORE = () => 0.99 // sorteio nunca reage
const BASE = { x: 30, y: 0.45, z: 30 }
const at = (dx, dz) => ({ x: BASE.x + dx, y: BASE.y, z: BASE.z + dz })

const worlds = []
afterEach(() => {
  while (worlds.length) worlds.pop().destroy()
})

function setup() {
  const world = createWorld()
  worlds.push(world)
  // Quem se move (a IA), em BASE.
  const mover = world.spawn(
    WildCreature({ speciesId: 'charmander' }),
    AiMovement,
    Position(at(0, 0)),
    Rotation,
    Velocity,
    MovementStats(CHARMANDER.movement),
    CharacterController(BODY),
    PhysicsBody,
    PathState,
    ActionState,
    IndividualValues,
    vitalsFromSpecies(CHARMANDER),
  )
  const spawnEnemy = (position) =>
    world.spawn(
      WildCreature({ speciesId: 'charmander' }),
      Position(position),
      Rotation,
      CharacterController(BODY),
      ActionState,
      IndividualValues,
      vitalsFromSpecies(CHARMANDER),
    )
  return { world, mover, spawnEnemy }
}

/** `attacker` carregando o golpe do `slot` há `elapsed` s, mirando em `dir`. */
function charge(attacker, slot, elapsed, dir) {
  const attack = resolveAttackForEntity(
    CHARMANDER,
    slot,
    attacker.get(IndividualValues),
  )
  attacker.set(ActionState, {
    current: 'attack',
    pendingSlot: slot,
    elapsed,
    animationSpeed: 1 / attack.duration,
    dirX: dir.x,
    dirZ: dir.z,
  })
  return attack
}

/**
 * Roda `moveInFight` como o system faz: com cópias de Position/Rotation/
 * Velocity/Vitals (o `updateEach` grava de volta — aqui, `entity.set`).
 */
function run(mover, target, overrides = {}, rng = IGNORE) {
  const fight = {
    pos: mover.get(Position),
    rot: mover.get(Rotation),
    vel: mover.get(Velocity),
    stats: mover.get(MovementStats),
    vitals: mover.get(Vitals),
    target,
    plan: null,
    stopDistance: 1.3,
    enemies: [{ entity: target, pos: target.get(Position) }],
    resting: false,
    waiting: false,
    delta: DELTA,
    ...overrides,
  }
  const mode = moveInFight(mover, fight, rng)
  mover.set(Position, fight.pos)
  mover.set(Rotation, fight.rot)
  mover.set(Velocity, fight.vel)
  mover.set(Vitals, fight.vitals)
  return mode
}

const velOf = (entity) => entity.get(Velocity)
const speedOf = (entity) => Math.hypot(velOf(entity).x, velOf(entity).z)

describe('resolveIncomingAttack — dentro do aviso de um golpe', () => {
  it('na cápsula do golpe, carregando: quanto falta, quanto andar e pra que lado', () => {
    const { mover, spawnEnemy } = setup()
    // Atacante 1m atrás (-Z), golpeando pra +Z; ela 0.1m pro lado +X.
    mover.set(Position, at(0.1, 0))
    const enemy = spawnEnemy(at(0, -1))
    charge(enemy, 'primary', 0.05, { x: 0, z: 1 })

    const incoming = resolveIncomingAttack(
      enemy,
      enemy.get(Position),
      mover.get(Position),
      BODY.capsuleRadius,
    )

    expect(incoming.timeLeft).toBeGreaterThan(0)
    // radius + corpo - 0.1 de lado até sair.
    const basic = resolveAttackForEntity(CHARMANDER, 'primary', null)
    expect(incoming.exitDistance).toBeCloseTo(
      basic.radius + BODY.capsuleRadius - 0.1,
    )
    // Sai pro lado em que já está (+X).
    expect(incoming.dodgeX).toBeCloseTo(1)
    expect(incoming.dodgeZ).toBeCloseTo(0)
  })

  it('fora da área, depois do golpe ou sem golpe: nada', () => {
    const { mover, spawnEnemy } = setup()
    const enemy = spawnEnemy(at(0, -1))
    const check = () =>
      resolveIncomingAttack(
        enemy,
        enemy.get(Position),
        mover.get(Position),
        BODY.capsuleRadius,
      )

    expect(check()).toBeNull() // sem golpe
    charge(enemy, 'primary', 0.05, { x: 1, z: 0 }) // golpe pro lado
    expect(check()).toBeNull()
    charge(enemy, 'primary', 5, { x: 0, z: 1 }) // já aconteceu
    expect(check()).toBeNull()
  })

  it('cone (Growl): conta a abertura do cone', () => {
    const { mover, spawnEnemy } = setup()
    mover.set(Position, at(1, 0))
    const enemy = spawnEnemy(at(0, -2))
    charge(enemy, 'secondary1', 0.1, { x: 0, z: 1 })
    expect(
      resolveIncomingAttack(
        enemy,
        enemy.get(Position),
        mover.get(Position),
        BODY.capsuleRadius,
      ),
    ).not.toBeNull()
  })
})

describe('moveInFight — desvio', () => {
  function incomingSetup() {
    const { mover, spawnEnemy } = setup()
    mover.set(Position, at(0.1, 0))
    const enemy = spawnEnemy(at(0, -1))
    return { mover, enemy }
  }

  it('reage (sorteio) depois do tempo de reação: corre pro lado', () => {
    const { mover, enemy } = incomingSetup()
    charge(enemy, 'primary', MOVE.DODGE_REACTION_TIME + 0.01, { x: 0, z: 1 })

    expect(run(mover, enemy, {}, REACT)).toBe('dodge')
    expect(velOf(mover).x).toBeGreaterThan(0)
    expect(Math.abs(velOf(mover).z)).toBeLessThan(1e-6)
  })

  it('antes do tempo de reação, não desvia ainda', () => {
    const { mover, enemy } = incomingSetup()
    charge(enemy, 'primary', MOVE.DODGE_REACTION_TIME / 2, { x: 0, z: 1 })
    expect(run(mover, enemy, {}, REACT)).not.toBe('dodge')
  })

  it('o sorteio é UMA vez por golpe: não reagiu, não reage no tick seguinte', () => {
    const { mover, enemy } = incomingSetup()
    charge(enemy, 'primary', MOVE.DODGE_REACTION_TIME + 0.01, { x: 0, z: 1 })

    expect(run(mover, enemy, {}, IGNORE)).not.toBe('dodge')
    expect(run(mover, enemy, {}, REACT)).not.toBe('dodge')
  })

  it('golpe acabou: o próximo golpe é sorteado de novo', () => {
    const { mover, enemy } = incomingSetup()
    charge(enemy, 'primary', MOVE.DODGE_REACTION_TIME + 0.01, { x: 0, z: 1 })
    run(mover, enemy, {}, IGNORE)

    enemy.set(ActionState, { current: null })
    run(mover, enemy, {}, IGNORE)
    charge(enemy, 'primary', MOVE.DODGE_REACTION_TIME + 0.01, { x: 0, z: 1 })
    expect(run(mover, enemy, {}, REACT)).toBe('dodge')
  })

  it('descansando, não desvia', () => {
    const { mover, enemy } = incomingSetup()
    charge(enemy, 'primary', MOVE.DODGE_REACTION_TIME + 0.01, { x: 0, z: 1 })
    expect(run(mover, enemy, { resting: true }, REACT)).not.toBe('dodge')
  })

  it('correndo não dá tempo: sai de dash (gasta energia); sem chão, corre', () => {
    const { mover, enemy } = incomingSetup()
    const attack = charge(enemy, 'primary', 0, { x: 0, z: 1 })
    // Quase no golpe: não dá pra sair correndo a tempo.
    const hitAt = attack.effectAt
    enemy.set(ActionState, { elapsed: hitAt - 0.02 })

    expect(run(mover, enemy, {}, REACT)).toBe('dodge')

    mover.add(Grounded)
    mover.set(AiMovement, { dodgeAttacker: null })
    const before = mover.get(Vitals)
    expect(run(mover, enemy, {}, REACT)).toBe('dash')
    expect(mover.get(ActionState).current).toBe('dash')
    // O custo da entidade (pelo nível, 035) — vida cheia, sem multiplicador.
    expect(mover.get(Vitals).stamina).toBeCloseTo(
      before.stamina - before.dashStaminaCost,
    )
    expect(velOf(mover).x).toBeCloseTo(DASH.SPEED)
  })
})

describe('moveInFight — o corpo gira pra onde está indo (dash e desvio)', () => {
  // Relatado jogando: "um bulba deu um dash pra mim virado de costas" e,
  // desviando pouco pro lado sem girar, "pareceu que teleportou".
  const yawOf = (entity) => entity.get(Rotation).y

  it('desviando: gira pro lado do desvio, não fica encarando o alvo', () => {
    const { mover, spawnEnemy } = setup()
    mover.set(Position, at(0.1, 0))
    const enemy = spawnEnemy(at(0, -1))
    charge(enemy, 'primary', MOVE.DODGE_REACTION_TIME + 0.01, { x: 0, z: 1 })
    mover.set(Rotation, { y: Math.PI }) // encarando o atacante (-Z)

    for (let i = 0; i < 20; i++)
      expect(run(mover, enemy, {}, REACT)).toBe('dodge')

    // Desvio pra +X: yaw π/2.
    expect(yawOf(mover)).toBeCloseTo(Math.PI / 2, 1)
  })

  it('dash de aproximação começando de costas: vira pro alvo durante o dash', () => {
    const { mover, spawnEnemy } = setup()
    mover.add(Grounded)
    mover.set(Rotation, { y: Math.PI }) // de costas pro alvo (+Z)
    const far = spawnEnemy(at(0, 1.3 + MOVE.DASH_CLOSE_DISTANCE + 1))

    expect(run(mover, far)).toBe('dash')
    expect(Math.abs(yawOf(mover))).toBeLessThan(Math.PI) // já começou a virar
    for (let i = 0; i < 25; i++) {
      const moving = {
        rot: mover.get(Rotation),
        vel: mover.get(Velocity),
        stats: mover.get(MovementStats),
      }
      advanceAiDash(mover, moving, DELTA)
      mover.set(Rotation, moving.rot)
    }

    expect(yawOf(mover)).toBeCloseTo(0, 1)
  })
})

describe('moveInFight — recuo, aproximação e dash', () => {
  it('golpe à distância planejado e o alvo perto: recua pra longe dele', () => {
    const { mover, spawnEnemy } = setup()
    const target = spawnEnemy(at(0, 1)) // em +Z
    const ember = resolveAttackForEntity(CHARMANDER, 'secondary3', null)
    const plan = {
      slot: 'secondary3',
      attack: ember,
      reach: resolveReachFor(ember, BODY),
    }

    // Vira pra trás aos poucos (`turnSpeed`) e anda pra onde está virada.
    let mode
    for (let i = 0; i < 60; i++) {
      mode = run(mover, target, { plan, stopDistance: plan.reach * 0.8 })
    }

    expect(mode).toBe('retreat')
    expect(velOf(mover).z).toBeLessThan(0)
  })

  it('golpe corpo a corpo com o alvo perto: não recua', () => {
    const { mover, spawnEnemy } = setup()
    const target = spawnEnemy(at(0, 0.5)) // perto o bastante pra recuar
    const basic = resolveAttackForEntity(CHARMANDER, 'primary', null)
    const plan = {
      slot: 'primary',
      attack: basic,
      reach: resolveReachFor(basic, BODY),
    }
    expect(run(mover, target, { plan, stopDistance: 1.3 })).not.toBe('retreat')
  })

  it('longe do alcance: corre; MUITO longe e no chão: dash, com intervalo entre dashes', () => {
    const { mover, spawnEnemy } = setup()
    const near = spawnEnemy(at(0, 3))
    expect(run(mover, near)).toBe('approach')

    const far = spawnEnemy(at(0, 1.3 + MOVE.DASH_CLOSE_DISTANCE + 1))
    expect(run(mover, far)).toBe('approach') // sem chão
    mover.add(Grounded)
    expect(run(mover, far)).toBe('dash')
    expect(velOf(mover).z).toBeCloseTo(DASH.SPEED)

    mover.set(ActionState, { current: null })
    expect(run(mover, far)).toBe('approach')
    // A recarga é a mesma do jogador (`DashCooldown`, 035).
    expect(mover.get(DashCooldown).timeLeft).toBeCloseTo(DASH.COOLDOWN)
  })

  it('dash ferido custa mais energia (vida baixa)', () => {
    const { mover, spawnEnemy } = setup()
    mover.add(Grounded)
    const far = spawnEnemy(at(0, 1.3 + MOVE.DASH_CLOSE_DISTANCE + 1))
    const { maxHp } = mover.get(Vitals)
    mover.set(Vitals, { hp: maxHp * 0.5 })
    const before = mover.get(Vitals)

    expect(run(mover, far)).toBe('dash')
    expect(mover.get(Vitals).stamina).toBeCloseTo(
      before.stamina - resolveDashCost(before),
    )
    expect(resolveDashCost(before)).toBeGreaterThan(before.dashStaminaCost)
  })

  it('dash respeita a reserva de energia e o descanso', () => {
    const { mover, spawnEnemy } = setup()
    mover.add(Grounded)
    const far = spawnEnemy(at(0, 1.3 + MOVE.DASH_CLOSE_DISTANCE + 1))
    const { maxStamina } = mover.get(Vitals)
    mover.set(Vitals, {
      stamina: GAME_CONFIG.AI_ENERGY.SKILL_RESERVE_FRACTION * maxStamina,
    })
    expect(run(mover, far)).toBe('approach')

    mover.set(Vitals, { stamina: maxStamina })
    expect(run(mover, far, { resting: true })).toBe('approach')
    // Descansando, anda (não corre).
    expect(speedOf(mover)).toBeLessThanOrEqual(
      CHARMANDER.movement.walkSpeed + 1e-6,
    )
  })
})

describe('moveInFight — rodear o alvo', () => {
  it('no alcance esperando: anda de lado (andando), virada pra onde anda', () => {
    const { mover, spawnEnemy } = setup()
    const target = spawnEnemy(at(0, 1.2)) // em +Z, dentro do alcance

    for (let i = 0; i < 30; i++) {
      expect(run(mover, target, { waiting: true })).toBe('strafe')
    }
    const vel = velOf(mover)
    // Quase só de lado (X): a correção radial é pequena.
    expect(Math.abs(vel.x)).toBeGreaterThan(Math.abs(vel.z))
    expect(speedOf(mover)).toBeLessThanOrEqual(CHARMANDER.movement.walkSpeed)
    // O corpo vira pra direção do movimento (de lado pro alvo), não encara.
    const moveYaw = Math.atan2(vel.x, vel.z)
    expect(mover.get(Rotation).y).toBeCloseTo(moveYaw, 1)
  })

  it('troca de sentido quando o tempo acaba', () => {
    const { mover, spawnEnemy } = setup()
    const target = spawnEnemy(at(0, 1.2))
    run(mover, target, { waiting: true }, () => 0)
    const firstX = Math.sign(velOf(mover).x)

    mover.set(AiMovement, { strafeTimer: 0 })
    run(mover, target, { waiting: true }, () => 0)
    expect(Math.sign(velOf(mover).x)).toBe(-firstX)
  })

  it('golpe pronto vindo de lado: para e vira pro alvo (aim) antes de liberar', () => {
    const { mover, spawnEnemy } = setup()
    const target = spawnEnemy(at(0, 1.2)) // em +Z (yaw 0)
    mover.set(Rotation, { y: Math.PI / 2 })

    expect(run(mover, target)).toBe('aim')
    expect(speedOf(mover)).toBe(0)
    let mode = 'aim'
    for (let i = 0; i < 30 && mode === 'aim'; i++) mode = run(mover, target)
    expect(mode).toBeNull()
    expect(Math.abs(mover.get(Rotation).y)).toBeLessThanOrEqual(
      MOVE.AIM_TOLERANCE,
    )
  })

  it('golpe pronto (sem esperar): para e encara', () => {
    const { mover, spawnEnemy } = setup()
    const target = spawnEnemy(at(0, 1.2))
    expect(run(mover, target)).toBeNull()
    expect(speedOf(mover)).toBe(0)
  })
})

describe('steerAiBeam — feixe seguindo o alvo', () => {
  it('gira no máximo BEAM_TURN_SPEED por segundo', () => {
    const action = { dirX: 0, dirY: 0, dirZ: 1 }
    const yaw = steerAiBeam(action, { x: 0, z: 0 }, { x: 5, z: 0 }, 0.1)
    expect(yaw).toBeCloseTo(MOVE.BEAM_TURN_SPEED * 0.1)
    expect(Math.hypot(action.dirX, action.dirZ)).toBeCloseTo(1)
  })

  it('perto do alvo, chega exatamente nele', () => {
    const action = { dirX: 0, dirY: 0, dirZ: 1 }
    const yaw = steerAiBeam(action, { x: 0, z: 0 }, { x: 0.01, z: 1 }, 1)
    expect(yaw).toBeCloseTo(Math.atan2(0.01, 1))
  })
})
