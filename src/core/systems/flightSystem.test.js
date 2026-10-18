import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createWorld } from 'koota'
import {
  ActionState,
  CharacterController,
  FlightStats,
  Flying,
  AnimationState,
  Grounded,
  HeldItem,
  InputControlled,
  InputState,
  MovementStats,
  OrbitCamera,
  PhysicsBody,
  Position,
  Rotation,
  Velocity,
  Vitals,
} from '@/core/traits'
import { vitalsFromSpecies } from '@/core/traits/components/vitals'
import { initPhysics, disposePhysics } from '@/core/physics/physicsWorld'
import { verticalClearance } from '@/core/physics/colliders'
import { getSpecies } from '@/core/data/species'
import { GAME_CONFIG } from '@/core/gameConfig'
import { desmaiar } from '@/core/actions/faint'
import { withDeepWater } from '@/test/deepWater'
import { animationStateSystem } from './animationStateSystem'
import { playerActionSystem } from './playerActionSystem'
import { inputSystem } from './inputSystem'
import { physicsBootstrapSystem } from './physicsBootstrapSystem'
import { cameraControlSystem } from './cameraControlSystem'
import { movementSystem } from './movementSystem'
import { flightSystem } from './flightSystem'
import { characterPhysicsSystem } from './characterPhysicsSystem'
import { physicsStepSystem } from './physicsStepSystem'
import { syncPhysicsSystem } from './syncPhysicsSystem'

// Chão plano em y = 0 (`src/test/flatTestLevel.js`).
vi.mock('@/core/data/testLevel', async (importOriginal) => {
  const { withFlatTestLevel } = await import('@/test/flatTestLevel')
  return withFlatTestLevel(await importOriginal())
})

const SPEAROW = getSpecies('spearow')
const { FLIGHT } = GAME_CONFIG

function makeFlyer() {
  const world = createWorld()
  const bird = world.spawn(
    Position({ x: 0, y: 1, z: 0 }),
    Rotation,
    Velocity,
    InputState,
    InputControlled,
    // o `inputSystem` escreve a intenção em quem tem `HeldItem` (como a
    // criatura invocada)
    HeldItem,
    ActionState,
    AnimationState,
    MovementStats(SPEAROW.movement),
    FlightStats(SPEAROW.flight),
    vitalsFromSpecies(SPEAROW),
    PhysicsBody,
    CharacterController(SPEAROW.body),
  )
  world.spawn(OrbitCamera({ pitch: FLIGHT.NEUTRAL_PITCH }))
  return { world, bird }
}

function tick(world, input = {}) {
  const ctx = { world, delta: 1 / 60, input }
  inputSystem(ctx)
  physicsBootstrapSystem(ctx)
  cameraControlSystem(ctx)
  movementSystem(ctx)
  playerActionSystem(ctx)
  flightSystem(ctx)
  characterPhysicsSystem(ctx)
  physicsStepSystem(ctx)
  syncPhysicsSystem(ctx)
  animationStateSystem(ctx)
}

const run = (world, n, input) => {
  for (let i = 0; i < n; i++) tick(world, input)
}

const feetOf = (bird) =>
  bird.get(Position).y - verticalClearance(bird.get(CharacterController))

/**
 * Assenta no chão e decola (`V`), até passar da decolagem e o embalo da
 * subida assentar (pairando).
 */
function takeOff(world) {
  run(world, 60)
  tick(world, { fly: true })
  run(world, Math.ceil(FLIGHT.TAKEOFF_DURATION * 60) + 5)
  run(world, Math.ceil((4 / FLIGHT.BRAKE) * 60))
}

describe('flightSystem (voo livre)', () => {
  beforeEach(async () => {
    await initPhysics()
  })
  afterEach(() => {
    disposePhysics()
  })

  it('V no chão decola e sobe', () => {
    const { world, bird } = makeFlyer()
    run(world, 60)
    expect(bird.has(Grounded)).toBe(true)
    const before = feetOf(bird)

    tick(world, { fly: true })
    run(world, 20)

    expect(bird.has(Flying)).toBe(true)
    expect(feetOf(bird)).toBeGreaterThan(before + 0.2)
    world.destroy()
  })

  it('sem a stamina mínima, não decola', () => {
    const { world, bird } = makeFlyer()
    run(world, 60)
    const vitals = bird.get(Vitals)
    bird.set(Vitals, {
      stamina: vitals.maxStamina * FLIGHT.MIN_TAKEOFF_STAMINA * 0.5,
    })
    tick(world, { fly: true })
    run(world, 10)
    expect(bird.has(Flying)).toBe(false)
    world.destroy()
  })

  it('pula (Espaço) no chão normalmente; no ar o Espaço não faz nada', () => {
    const { world, bird } = makeFlyer()
    takeOff(world)
    const y = bird.get(Position).y
    tick(world, { jump: true })
    expect(bird.get(Velocity).y).toBeLessThan(SPEAROW.movement.jumpSpeed)
    expect(bird.get(Position).y).toBeLessThan(y + 0.1)
    world.destroy()
  })

  it('voando gasta stamina e não regenera', () => {
    const { world, bird } = makeFlyer()
    takeOff(world)
    const before = bird.get(Vitals).stamina
    run(world, 60)
    expect(bird.get(Vitals).stamina).toBeLessThan(before)
    world.destroy()
  })

  it('W com a câmera no pitch neutro voa reto pra frente', () => {
    const { world, bird } = makeFlyer()
    takeOff(world)
    const start = { ...bird.get(Position) }
    run(world, 30, { forward: true })
    const end = bird.get(Position)
    expect(Math.hypot(end.x - start.x, end.z - start.z)).toBeGreaterThan(1)
    expect(Math.abs(end.y - start.y)).toBeLessThan(0.1)
    world.destroy()
  })

  /** Voa com W olhando pra cima, com a câmera mexendo ou não na altura. */
  function climbLookingUp(pitchControl) {
    const original = FLIGHT.CAMERA_PITCH_CONTROL
    FLIGHT.CAMERA_PITCH_CONTROL = pitchControl
    try {
      const { world, bird } = makeFlyer()
      takeOff(world)
      world.queryFirst(OrbitCamera).set(OrbitCamera, {
        pitch: FLIGHT.NEUTRAL_PITCH - 0.6,
      })
      const y = bird.get(Position).y
      run(world, 30, { forward: true })
      const climbed = bird.get(Position).y - y
      world.destroy()
      return climbed
    } finally {
      FLIGHT.CAMERA_PITCH_CONTROL = original
    }
  }

  it('com a câmera na altura: olhando pra cima, W sobe', () => {
    expect(climbLookingUp(true)).toBeGreaterThan(0.5)
  })

  it('sem a câmera na altura: olhando pra cima, W segue reto', () => {
    expect(Math.abs(climbLookingUp(false))).toBeLessThan(0.1)
  })

  it('não passa do teto da stamina', () => {
    const { world, bird } = makeFlyer()
    takeOff(world)
    const vitals = bird.get(Vitals)
    bird.set(Vitals, { stamina: vitals.maxStamina * 0.1 })
    run(world, 240, { forward: true, ascend: true })
    const ceiling =
      (bird.get(Vitals).stamina / vitals.maxStamina) * FLIGHT.MAX_HEIGHT
    expect(feetOf(bird)).toBeLessThanOrEqual(ceiling + 0.05)
    world.destroy()
  })

  it('stamina zerada: desce e pousa', () => {
    const { world, bird } = makeFlyer()
    takeOff(world)
    bird.set(Vitals, { stamina: 0 })
    run(world, 240)
    expect(bird.has(Flying)).toBe(false)
    expect(bird.has(Grounded)).toBe(true)
    world.destroy()
  })

  it('V no ar pousa', () => {
    const { world, bird } = makeFlyer()
    takeOff(world)
    tick(world, { fly: true })
    run(world, 240)
    expect(bird.has(Flying)).toBe(false)
    expect(bird.has(Grounded)).toBe(true)
    world.destroy()
  })

  it('sem o controle do jogador, desce e pousa', () => {
    const { world, bird } = makeFlyer()
    takeOff(world)
    bird.remove(InputControlled)
    run(world, 240)
    expect(bird.has(Flying)).toBe(false)
    world.destroy()
  })

  it('desmaiada, para de voar', () => {
    const { world, bird } = makeFlyer()
    takeOff(world)
    desmaiar(world, bird)
    tick(world)
    expect(bird.has(Flying)).toBe(false)
    world.destroy()
  })

  it('sobre água funda, com a stamina zerada, fica rente à superfície', () => {
    const { world, bird } = makeFlyer()
    takeOff(world)
    bird.set(Vitals, { stamina: 0 })
    withDeepWater(() => run(world, 240))
    expect(bird.has(Flying)).toBe(true)
    expect(feetOf(bird)).toBeGreaterThanOrEqual(
      GAME_CONFIG.TERRAIN.WATER_LEVEL - 0.01,
    )
    world.destroy()
  })
})

describe('flightSystem — Espaço/C, dash no ar e animação (060)', () => {
  beforeEach(async () => {
    await initPhysics()
  })
  afterEach(() => {
    disposePhysics()
  })

  it('Espaço segurado sobe e C desce', () => {
    const { world, bird } = makeFlyer()
    takeOff(world)
    const y = bird.get(Position).y
    run(world, 30, { ascend: true })
    const up = bird.get(Position).y
    expect(up).toBeGreaterThan(y + 0.5)
    // com embalo, leva um instante pra inverter
    run(world, 60, { descend: true })
    expect(bird.get(Position).y).toBeLessThan(up - 0.5)
    world.destroy()
  })

  it('dash no ar: sai e anda bem mais que o voo no mesmo tempo', () => {
    const { world, bird } = makeFlyer()
    takeOff(world)
    const start = { ...bird.get(Position) }
    tick(world, { dash: true })
    expect(bird.get(ActionState).current).toBe('dash')
    run(world, 10)
    const dashed = Math.hypot(
      bird.get(Position).x - start.x,
      bird.get(Position).z - start.z,
    )
    expect(dashed).toBeGreaterThan((SPEAROW.flight.fastSpeed * 11) / 60)
    expect(bird.has(Flying)).toBe(true)
    world.destroy()
  })

  it('descendo pelo teto da stamina, sem tecla: continua pairando', () => {
    const { world, bird } = makeFlyer()
    takeOff(world)
    run(world, 40, { ascend: true })
    bird.set(Vitals, { stamina: bird.get(Vitals).maxStamina * 0.01 })
    const states = new Set()
    for (let i = 0; i < 60; i++) {
      tick(world)
      states.add(bird.get(AnimationState).id)
    }
    expect([...states]).toEqual(['flyIdle'])
    world.destroy()
  })
})

describe('flightSystem — embalo (060)', () => {
  beforeEach(async () => {
    await initPhysics()
  })
  afterEach(() => {
    disposePhysics()
  })

  it('ao soltar o W, desliza até parar (não para seco)', () => {
    const { world, bird } = makeFlyer()
    takeOff(world)
    run(world, 60, { forward: true })
    const cruising = Math.hypot(bird.get(Velocity).x, bird.get(Velocity).z)
    tick(world)
    const after = Math.hypot(bird.get(Velocity).x, bird.get(Velocity).z)
    expect(after).toBeGreaterThan(cruising * 0.5)
    run(world, 300)
    expect(Math.hypot(bird.get(Velocity).x, bird.get(Velocity).z)).toBeLessThan(
      0.05,
    )
    world.destroy()
  })
})

describe('flightSystem — queda pela stamina suave (060)', () => {
  beforeEach(async () => {
    await initPhysics()
  })
  afterEach(() => {
    disposePhysics()
  })

  it('stamina caindo de uma vez: a descida começa aos poucos e para no teto', () => {
    const { world, bird } = makeFlyer()
    takeOff(world)
    run(world, 90, { ascend: true })
    run(world, 120) // assenta pairando
    const max = bird.get(Vitals).maxStamina
    // o teto cai alguns metros num tick só (como um dash gastando um pedaço)
    const startFeet = feetOf(bird)
    expect(startFeet).toBeGreaterThan(2.5)
    const ceilingFeet = startFeet - 2
    bird.set(Vitals, { stamina: (ceilingFeet / FLIGHT.MAX_HEIGHT) * max })

    let previous = bird.get(Velocity).y
    let biggestStep = 0
    for (let i = 0; i < 300; i++) {
      tick(world)
      const vy = bird.get(Velocity).y
      biggestStep = Math.max(biggestStep, Math.abs(vy - previous))
      previous = vy
    }
    // nada de pular pra descida cheia num tick
    expect(biggestStep).toBeLessThan(FLIGHT.CEILING_DESCENT_SPEED / 4)
    const ceiling = (bird.get(Vitals).stamina / max) * FLIGHT.MAX_HEIGHT
    expect(feetOf(bird)).toBeLessThan(ceiling + 0.2)
    expect(feetOf(bird)).toBeLessThan(startFeet - 1.5)
    world.destroy()
  })
})
