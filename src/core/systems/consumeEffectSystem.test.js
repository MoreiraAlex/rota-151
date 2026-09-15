import { describe, it, expect, afterEach } from 'vitest'
import { createWorld } from 'koota'
import { ConsumeEffect } from '@/core/traits'
import { consumeEffectSystem } from './consumeEffectSystem'

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
  consumeEffectSystem({ world, delta })
}

describe('consumeEffectSystem', () => {
  it('conta o lifetime pra baixo e destrói a entidade ao chegar a zero', () => {
    const world = spawnWorld()
    world.spawn(ConsumeEffect({ lifetime: 2 / 60 }))

    expect(world.query(ConsumeEffect).length).toBe(1)

    tick(world, 1 / 60) // ainda não zerou
    expect(world.query(ConsumeEffect).length).toBe(1)

    tick(world, 1 / 60) // agora zera
    expect(world.query(ConsumeEffect).length).toBe(0)
  })
})
