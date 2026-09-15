import { describe, it, expect, afterEach } from 'vitest'
import { createWorld } from 'koota'
import { makeWorld } from '@/test/makeWorld'
import { Projectile, Position, Velocity, PhysicsBody } from '@/core/traits'
import {
  initPhysics,
  disposePhysics,
  stepPhysics,
} from '@/core/physics/physicsWorld'
import {
  createStaticLevel,
  createCharacterBody,
} from '@/core/physics/colliders'
import { projectileSystem } from './projectileSystem'

const spawnedWorlds = []
function spawnWorld() {
  const world = createWorld()
  spawnedWorlds.push(world)
  return world
}

afterEach(() => {
  while (spawnedWorlds.length) spawnedWorlds.pop().destroy()
})

function tick(world, delta = 1 / 60) {
  projectileSystem({ world, delta })
}

describe('projectileSystem', () => {
  it('integra a posição pela velocidade', () => {
    const world = spawnWorld()
    const projectile = world.spawn(
      Position({ x: 0, y: 0, z: 0 }),
      Velocity({ x: 10, y: 0, z: 0 }),
      Projectile({ lifetime: 5 }),
    )

    tick(world, 1)

    expect(projectile.get(Position).x).toBeCloseTo(10)
  })

  it('não sofre gravidade — voo reto, sem arco (pedido explícito)', () => {
    const world = spawnWorld()
    const projectile = world.spawn(
      Position({ x: 0, y: 0, z: 0 }),
      Velocity({ x: 5, y: 2, z: 0 }),
      Projectile({ lifetime: 5 }),
    )

    tick(world, 1)

    expect(projectile.get(Velocity)).toMatchObject({ x: 5, y: 2, z: 0 })
    expect(projectile.get(Position).y).toBeCloseTo(2)
  })

  it('conta o lifetime pra baixo e destrói a entidade ao chegar a zero', () => {
    const world = spawnWorld()
    world.spawn(
      Position({ x: 0, y: 0, z: 0 }),
      Velocity({ x: 0, y: 0, z: 0 }),
      Projectile({ lifetime: 2 / 60 }),
    )

    expect(world.query(Projectile).length).toBe(1)

    tick(world, 1 / 60) // ainda não zerou
    expect(world.query(Projectile).length).toBe(1)

    tick(world, 1 / 60) // agora zera
    expect(world.query(Projectile).length).toBe(0)
  })
})

describe('projectileSystem — colisão com o mundo', () => {
  afterEach(() => {
    disposePhysics()
  })

  it('para no ponto de impacto ao atingir o chão, marcando hit', async () => {
    await initPhysics()
    createStaticLevel()
    stepPhysics() // broad-phase só existe depois de um step (ver raycast.js)

    const world = spawnWorld()
    // Sem gravidade (voo reto), a velocidade precisa apontar pro chão de
    // propósito — nada mais faz o projétil descer sozinho.
    const projectile = world.spawn(
      Position({ x: 0, y: 3, z: 0 }),
      Velocity({ x: 0, y: -20, z: 0 }),
      Projectile({ lifetime: 5 }),
    )

    // Ticks grandes o bastante pro segmento do tick varrer o chão (y=0) em
    // vez de "pular" por cima dele.
    for (let i = 0; i < 30; i++) tick(world, 1 / 30)

    expect(projectile.get(Projectile).hit).toBe(true)
    expect(projectile.get(Position).y).toBeCloseTo(0, 1)
    expect(projectile.get(Velocity).y).toBe(0)
  })

  it('depois de colidir, congela (não integra mais posição) mas o lifetime continua contando', async () => {
    await initPhysics()
    createStaticLevel()
    stepPhysics()

    const world = spawnWorld()
    const projectile = world.spawn(
      Position({ x: 0, y: 3, z: 0 }),
      Velocity({ x: 0, y: -20, z: 0 }),
      Projectile({ lifetime: 5 }),
    )

    for (let i = 0; i < 30; i++) tick(world, 1 / 30)
    expect(projectile.get(Projectile).hit).toBe(true)
    const posAfterHit = { ...projectile.get(Position) }

    tick(world, 1)
    expect(projectile.get(Position)).toEqual(posAfterHit)
    expect(projectile.get(Projectile).lifetime).toBeLessThan(5)
  })

  it('exclui a cápsula de quem atirou — não se autoacerta logo ao nascer perto do próprio corpo', async () => {
    await initPhysics()
    createStaticLevel()

    const { world, player } = makeWorld({
      playerPosition: { x: 0, y: 2, z: 0 },
    })
    spawnedWorlds.push(world)
    const { bodyHandle, colliderHandle } = createCharacterBody(
      player.get(Position),
      { radius: 0.5, halfHeight: 0.5, axis: 'y' },
    )
    player.set(PhysicsBody, { bodyHandle, colliderHandle })
    stepPhysics()

    // Nasce a 1 unidade acima do centro do atirador — dentro/bem perto da
    // própria cápsula (raio 0.5 + meia-altura 0.5 = topo em y=3).
    const projectile = world.spawn(
      Position({ x: 0, y: 3, z: 0 }),
      Velocity({ x: 5, y: 0, z: 0 }),
      Projectile({ lifetime: 5 }),
    )

    tick(world, 1 / 60)

    expect(projectile.get(Projectile).hit).toBe(false)
  })
})
