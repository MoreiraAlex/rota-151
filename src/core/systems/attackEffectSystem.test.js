import { describe, it, expect, afterEach } from 'vitest'
import { createWorld } from 'koota'
import { AttackEffect } from '@/core/traits'
import { attackEffectSystem } from './attackEffectSystem'

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
  attackEffectSystem({ world, delta })
}

describe('attackEffectSystem', () => {
  it('conta o lifetime pra baixo e destrói a entidade ao chegar a zero', () => {
    const world = spawnWorld()
    world.spawn(AttackEffect({ lifetime: 2 / 60, radius: 0.5 }))

    expect(world.query(AttackEffect).length).toBe(1)

    tick(world, 1 / 60) // ainda não zerou
    expect(world.query(AttackEffect).length).toBe(1)

    tick(world, 1 / 60) // agora zera
    expect(world.query(AttackEffect).length).toBe(0)
  })
})
