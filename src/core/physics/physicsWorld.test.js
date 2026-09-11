import { describe, it, expect, afterEach } from 'vitest'
import {
  initPhysics,
  disposePhysics,
  isPhysicsReady,
  getRapierWorld,
  isLevelBuilt,
  markLevelBuilt,
} from './physicsWorld'

describe('physicsWorld', () => {
  afterEach(() => {
    disposePhysics()
  })

  it('initPhysics deixa o mundo pronto', async () => {
    expect(isPhysicsReady()).toBe(false)
    await initPhysics()
    expect(isPhysicsReady()).toBe(true)
    expect(getRapierWorld()).not.toBeNull()
  })

  it('initPhysics é idempotente — chamadas concorrentes criam um só mundo', async () => {
    await Promise.all([initPhysics(), initPhysics(), initPhysics()])
    const world = getRapierWorld()
    await initPhysics()
    expect(getRapierWorld()).toBe(world)
  })

  it('disposePhysics reseta o estado e permite reinicializar', async () => {
    await initPhysics()
    markLevelBuilt()
    expect(isLevelBuilt()).toBe(true)

    disposePhysics()
    expect(isPhysicsReady()).toBe(false)
    expect(isLevelBuilt()).toBe(false)
    expect(getRapierWorld()).toBeNull()

    await initPhysics()
    expect(isPhysicsReady()).toBe(true)
  })
})
