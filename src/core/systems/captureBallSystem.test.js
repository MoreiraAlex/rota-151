import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  addStaticBox,
  initTestTerrain,
  settleTerrain,
} from '@/test/physicsTerrain'
import { disposePhysics } from '@/core/physics/physicsWorld'
import { makeWorld } from '@/test/makeWorld'
import { spawnWild } from '@/test/spawnWild'
import { createEventQueue, EVENT_TYPES } from '@/core/events'
import { GAME_CONFIG } from '@/core/gameConfig'
import { listItems } from '@/core/data/items'
import { resolveArcLaunch } from '@/core/aim'
import {
  BeingCaptured,
  CaptureBall,
  OwnedBy,
  Pokemon,
  Position,
  Rotation,
  Velocity,
} from '@/core/traits'
import { captureBallSystem, resolveAbsorbHop } from './captureBallSystem'

const DELTA = 1 / 60
const BALL_ID = listItems().find((item) => item.category === 'pokeball').id
const { CAPTURE } = GAME_CONFIG

let world
let player
let events
const worlds = []
beforeEach(() => {
  ;({ world, player } = makeWorld())
  worlds.push(world)
  events = createEventQueue()
})
afterEach(() => {
  while (worlds.length) worlds.pop().destroy()
})

function throwAt(target, from = { x: 0, y: 1.5, z: 0 }) {
  const velocity = resolveArcLaunch(
    from,
    target,
    CAPTURE.THROW_SPEED,
    CAPTURE.GRAVITY,
  )
  return world.spawn(
    Position(from),
    Rotation,
    Velocity(velocity),
    CaptureBall({ itemId: BALL_ID }),
    OwnedBy(player),
  )
}

function run(seconds, rng = () => 0) {
  const ticks = Math.round(seconds / DELTA)
  for (let i = 0; i < ticks; i++) {
    captureBallSystem({ world, delta: DELTA, events, rng })
  }
}

function stateOf(ball) {
  return ball.isAlive() ? ball.get(CaptureBall).state : 'gone'
}

function emitted(type) {
  return events.drain().filter((event) => event.type === type)
}

/** Tempo até a bola, já absorvendo, terminar de balançar todas as vezes. */
const SHAKING_TIME =
  CAPTURE.ABSORB_DURATION +
  2 + // queda até o chão
  CAPTURE.SHAKE_COUNT * CAPTURE.SHAKE_INTERVAL +
  CAPTURE.RESULT_DELAY +
  DELTA * 4

describe('captureBallSystem', () => {
  it('a bola em arco acerta o selvagem e ele entra nela', () => {
    const wild = spawnWild(world)
    const ball = throwAt(wild.get(Position))

    run(1.5)

    expect(wild.has(BeingCaptured)).toBe(true)
    expect(['absorbing', 'falling', 'shaking']).toContain(stateOf(ball))
  })

  it('todas as balançadas passam: capturado, o selvagem some e o registro existe', () => {
    const wild = spawnWild(world)
    const ball = throwAt(wild.get(Position))

    run(1.5 + SHAKING_TIME, () => 0)

    expect(wild.isAlive()).toBe(false)
    expect(world.query(Pokemon).length).toBe(1)
    const shook = events.drain()
    expect(
      shook.filter((e) => e.type === EVENT_TYPES.CAPTURE_SHOOK),
    ).toHaveLength(CAPTURE.SHAKE_COUNT)
    expect(
      shook.filter((e) => e.type === EVENT_TYPES.POKEMON_CAPTURED),
    ).toHaveLength(1)
    expect(['caught', 'gone']).toContain(stateOf(ball))
  })

  it('uma balançada falha: ele escapa e a bola some depois', () => {
    const wild = spawnWild(world)
    const ball = throwAt(wild.get(Position))

    run(1.5 + SHAKING_TIME, () => 0.999999)

    expect(wild.isAlive()).toBe(true)
    expect(wild.has(BeingCaptured)).toBe(false)
    expect(world.query(Pokemon).length).toBe(0)
    expect(emitted(EVENT_TYPES.CAPTURE_ESCAPED)).toHaveLength(1)

    run(CAPTURE.CAUGHT_LINGER + DELTA)
    expect(stateOf(ball)).toBe('gone')
  })

  it('errou: a bola vira perdida, rola e quebra', () => {
    spawnWild(world, { at: { x: 30, y: 1, z: 30 } })
    const ball = throwAt({ x: -10, y: 0, z: -10 })

    run(CAPTURE.MAX_FLIGHT_TIME + DELTA * 2)
    expect(stateOf(ball)).toBe('missed')

    run(CAPTURE.MISS_LIFETIME + DELTA)
    expect(stateOf(ball)).toBe('gone')
    expect(emitted(EVENT_TYPES.CAPTURE_BALL_BROKE)).toHaveLength(1)
  })

  it('uma segunda bola passa direto por quem já está dentro de outra', () => {
    const wild = spawnWild(world)
    const first = throwAt(wild.get(Position))
    run(0.8)
    expect(wild.has(BeingCaptured)).toBe(true)

    const second = throwAt(wild.get(Position))
    run(0.8)

    expect(first.get(CaptureBall).state).not.toBe('flying')
    expect(['flying', 'missed']).toContain(stateOf(second))
  })
})

describe('captureBallSystem — bola que erra, com física', () => {
  afterEach(() => disposePhysics())

  // Parede na frente (face em z = 3), mais alta que a bola.
  const WALL = { center: [0, 1.5, 3.5], halfExtents: [3, 1.5, 0.5] }
  const WALL_FACE_Z = WALL.center[2] - WALL.halfExtents[2]
  const WALL_TOP_Y = WALL.center[1] + WALL.halfExtents[1]

  it('bate na parede e quica de volta, sem subir pro topo dela', async () => {
    await initTestTerrain()
    addStaticBox(WALL)
    settleTerrain()
    const ball = world.spawn(
      Position({ x: 0, y: 1, z: 0 }),
      Rotation,
      Velocity({ x: 0, y: 2, z: 12 }),
      CaptureBall({ itemId: BALL_ID }),
      OwnedBy(player),
    )

    let highest = -Infinity
    for (let i = 0; i < Math.round(CAPTURE.MISS_LIFETIME / DELTA) - 2; i++) {
      captureBallSystem({ world, delta: DELTA, events, rng: () => 0 })
      if (!ball.isAlive()) break
      highest = Math.max(highest, ball.get(Position).y)
      expect(ball.get(Position).z).toBeLessThanOrEqual(
        WALL_FACE_Z - CAPTURE.BALL_RADIUS + 0.01,
      )
    }

    expect(ball.get(CaptureBall).state).toBe('missed')
    expect(highest).toBeLessThan(WALL_TOP_Y)
    // Voltou da parede e está no chão (topo em y = 0), parada ou rolando.
    expect(ball.get(Velocity).z).toBeLessThanOrEqual(0)
    expect(ball.get(Position).y).toBeCloseTo(CAPTURE.BALL_RADIUS, 1)
  })
})

describe('resolveAbsorbHop', () => {
  it('sobe até a altura do pulinho desacelerando e fica lá', () => {
    const { ABSORB_HOP_HEIGHT, ABSORB_HOP_TIME } = GAME_CONFIG.CAPTURE
    expect(resolveAbsorbHop(0)).toBe(0)
    const half = resolveAbsorbHop(ABSORB_HOP_TIME / 2)
    expect(half).toBeGreaterThan(ABSORB_HOP_HEIGHT / 2)
    expect(resolveAbsorbHop(ABSORB_HOP_TIME)).toBeCloseTo(ABSORB_HOP_HEIGHT)
    expect(resolveAbsorbHop(ABSORB_HOP_TIME * 3)).toBeCloseTo(ABSORB_HOP_HEIGHT)
  })
})
