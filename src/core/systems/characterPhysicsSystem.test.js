import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { makeWorld } from '@/test/makeWorld'
import { Position, Grounded } from '@/core/traits'
import { initPhysics, disposePhysics } from '@/core/physics/physicsWorld'
import { inputSystem } from './inputSystem'
import { physicsBootstrapSystem } from './physicsBootstrapSystem'
import { cameraControlSystem } from './cameraControlSystem'
import { movementSystem } from './movementSystem'
import { characterPhysicsSystem } from './characterPhysicsSystem'
import { physicsStepSystem } from './physicsStepSystem'
import { syncPhysicsSystem } from './syncPhysicsSystem'

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
    expect(pos.y).toBeGreaterThan(0.7)
    expect(pos.y).toBeLessThan(1.2)
    expect(player.has(Grounded)).toBe(true)
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
    expect(player.get(Position).y).toBeCloseTo(yGround, 1)
  })
})
