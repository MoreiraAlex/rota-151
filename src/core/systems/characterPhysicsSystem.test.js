import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createWorld } from 'koota'
import { makeWorld } from '@/test/makeWorld'
import {
  Position,
  Rotation,
  Velocity,
  InputState,
  InputControlled,
  MovementStats,
  OrbitCamera,
  CameraTarget,
  PhysicsBody,
  CharacterController,
  Grounded,
} from '@/core/traits'
import {
  initPhysics,
  disposePhysics,
  getRapierWorld,
} from '@/core/physics/physicsWorld'
import { axisQuaternion } from '@/core/physics/colliders'
import { getSpecies } from '@/core/data/species'
import { inputSystem } from './inputSystem'
import { physicsBootstrapSystem } from './physicsBootstrapSystem'
import { cameraControlSystem } from './cameraControlSystem'
import { movementSystem } from './movementSystem'
import { characterPhysicsSystem } from './characterPhysicsSystem'
import { physicsStepSystem } from './physicsStepSystem'
import { syncPhysicsSystem } from './syncPhysicsSystem'

const FOX = getSpecies('fox')

/** Extensão vertical da cápsula acima do chão em repouso — raio+meia-altura
 * em pé ('y'), só o raio deitada ('x'/'z', onde a meia-altura vira extensão
 * horizontal). */
function restingHeightFor({ capsuleRadius, capsuleHalfHeight, capsuleAxis }) {
  return capsuleAxis === 'y' ? capsuleRadius + capsuleHalfHeight : capsuleRadius
}

/** Como makeWorld, mas com um CharacterController customizado — pra testar
 * corpos com capsuleAxis diferente do Fox sem mudar o helper compartilhado. */
function makeWorldWithBody(body, playerPosition = { x: 0, y: 3, z: 0 }) {
  const world = createWorld()
  const player = world.spawn(
    Position(playerPosition),
    Rotation,
    Velocity,
    InputState,
    InputControlled,
    MovementStats(FOX.movement),
    CameraTarget,
    PhysicsBody,
    CharacterController(body),
  )
  const camera = world.spawn(OrbitCamera())
  return { world, player, camera }
}

/** Roda o pipeline fixo completo, na mesma ordem do registerSystems. */
function tick(world, input = {}) {
  const ctx = { world, delta: 1 / 60, input }
  inputSystem(ctx)
  physicsBootstrapSystem(ctx)
  cameraControlSystem(ctx)
  movementSystem(ctx)
  characterPhysicsSystem(ctx)
  physicsStepSystem(ctx)
  syncPhysicsSystem(ctx)
}

const run = (world, n, input) => {
  for (let i = 0; i < n; i++) tick(world, input)
}

describe('characterPhysicsSystem + integração Rapier', () => {
  beforeEach(async () => {
    await initPhysics()
  })
  afterEach(() => {
    disposePhysics()
  })

  it('cai da posição inicial e repousa no chão', () => {
    const { world, player } = makeWorld({
      playerPosition: { x: 0, y: 3, z: 0 },
    })
    run(world, 180)
    const pos = player.get(Position)
    // Repouso ≈ extensão vertical da cápsula acima do chão — deriva da
    // espécie (corpo e orientação) em vez de literal fixo, pra não quebrar
    // sempre que o corpo for redimensionado/reorientado.
    const restingHeight = restingHeightFor(FOX.body)
    expect(pos.y).toBeGreaterThan(restingHeight - 0.05)
    expect(pos.y).toBeLessThan(restingHeight + 0.3)
    expect(player.has(Grounded)).toBe(true)
  })

  it('cápsula deitada (capsuleAxis x) repousa numa altura diferente — só o raio, não raio+meia-altura', () => {
    const body = {
      ...FOX.body,
      capsuleRadius: 0.5,
      capsuleHalfHeight: 0.4, // bem alongada, pra diferença ficar clara
      capsuleAxis: 'x',
    }
    const { world, player } = makeWorldWithBody(body)
    run(world, 180)
    const pos = player.get(Position)
    const restingHeight = restingHeightFor(body)
    expect(restingHeight).toBeCloseTo(0.5) // confirma que a meia-altura não conta
    expect(pos.y).toBeGreaterThan(restingHeight - 0.05)
    expect(pos.y).toBeLessThan(restingHeight + 0.3)
    expect(player.has(Grounded)).toBe(true)
  })

  it('o corpo físico gira com Rotation.y — necessário pra cápsula deitada acompanhar a frente ao virar', () => {
    const { world, player } = makeWorld({
      playerPosition: { x: 0, y: 1, z: 0 },
    })
    run(world, 90, { right: true }) // gira até encarar +x
    const rot = player.get(Rotation)
    expect(rot.y).not.toBeCloseTo(0) // confirma que de fato girou

    const { bodyHandle } = player.get(PhysicsBody)
    const actualRotation = getRapierWorld().getRigidBody(bodyHandle).rotation()
    const expectedRotation = axisQuaternion('y', rot.y)
    expect(actualRotation.y).toBeCloseTo(expectedRotation.y)
    expect(actualRotation.w).toBeCloseTo(expectedRotation.w)
  })

  it('é bloqueado pela parede em z = -7', () => {
    const { world, player } = makeWorld({
      playerPosition: { x: 0, y: 1, z: 0 },
    })
    run(world, 150, { forward: true })
    expect(player.get(Position).z).toBeGreaterThan(-7)
    expect(player.get(Position).z).toBeLessThan(-3)
  })

  it('sobe a rampa andando em +x', () => {
    const { world, player } = makeWorld({
      playerPosition: { x: 0, y: 1, z: 0 },
    })
    run(world, 6)
    const yFlat = player.get(Position).y
    run(world, 140, { right: true })
    const pos = player.get(Position)
    expect(pos.x).toBeGreaterThan(4)
    expect(pos.y).toBeGreaterThan(yFlat + 0.4)
  })

  it('pula a partir do chão e volta a repousar', () => {
    const { world, player } = makeWorld({
      playerPosition: { x: 0, y: 1, z: 0 },
    })
    run(world, 30)
    const yGround = player.get(Position).y

    tick(world, { jump: true })
    let peak = yGround
    for (let i = 0; i < 100; i++) {
      tick(world)
      peak = Math.max(peak, player.get(Position).y)
    }

    expect(peak).toBeGreaterThan(yGround + 0.8)
    // Tolerância mais larga que um toBeCloseTo padrão: a precisão do pouso
    // depende da forma/orientação da cápsula (agora por espécie, ver
    // 008-colisao-e-movimento-por-especie.md), não só da altura do pulo —
    // uma cápsula bem alongada e deitada tem mais folga de contato ao
    // assentar do que uma quase esférica em pé.
    expect(Math.abs(player.get(Position).y - yGround)).toBeLessThan(0.15)
  })
})
