import { describe, it, expect, afterEach } from 'vitest'
import { createWorld } from 'koota'
import { SummonFlash, RecallBeam } from '@/core/traits'
import { summonEffectsSystem } from './summonEffectsSystem'

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
  summonEffectsSystem({ world, delta })
}

describe('summonEffectsSystem', () => {
  it('conta o lifetime do SummonFlash pra baixo e destrói a entidade ao chegar a zero', () => {
    const world = spawnWorld()
    world.spawn(SummonFlash({ lifetime: 2 / 60 }))

    expect(world.query(SummonFlash).length).toBe(1)

    tick(world, 1 / 60) // ainda não zerou
    expect(world.query(SummonFlash).length).toBe(1)

    tick(world, 1 / 60) // agora zera
    expect(world.query(SummonFlash).length).toBe(0)
  })

  it('conta o lifetime do RecallBeam pra baixo e destrói a entidade ao chegar a zero', () => {
    const world = spawnWorld()
    world.spawn(RecallBeam({ lifetime: 2 / 60 }))

    expect(world.query(RecallBeam).length).toBe(1)

    tick(world, 1 / 60)
    expect(world.query(RecallBeam).length).toBe(1)

    tick(world, 1 / 60)
    expect(world.query(RecallBeam).length).toBe(0)
  })

  it('os dois efeitos vivem no mesmo system sem interferir um no outro', () => {
    const world = spawnWorld()
    world.spawn(SummonFlash({ lifetime: 5 / 60 }))
    world.spawn(RecallBeam({ lifetime: 1 / 60 }))

    tick(world, 1 / 60)

    expect(world.query(SummonFlash).length).toBe(1) // ainda não zerou
    expect(world.query(RecallBeam).length).toBe(0) // já zerou
  })
})
