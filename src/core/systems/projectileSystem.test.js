import { describe, it, expect, afterEach } from 'vitest'
import { createWorld } from 'koota'
import { Projectile, Position, Velocity } from '@/core/traits'
import { GAME_CONFIG } from '@/core/gameConfig'
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

  it('sofre a mesma gravidade do personagem', () => {
    const world = spawnWorld()
    const projectile = world.spawn(
      Position({ x: 0, y: 0, z: 0 }),
      Velocity({ x: 0, y: 0, z: 0 }),
      Projectile({ lifetime: 5 }),
    )

    tick(world, 1)

    expect(projectile.get(Velocity).y).toBeCloseTo(GAME_CONFIG.PHYSICS.GRAVITY)
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
