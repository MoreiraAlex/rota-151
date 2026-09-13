import { describe, it, expect } from 'vitest'
import { makeWorld } from '@/test/makeWorld'
import { Velocity, AnimationState, Grounded } from '@/core/traits'
import { animationStateSystem } from './animationStateSystem'

function resolve(world, player) {
  animationStateSystem({ world })
  return player.get(AnimationState).id
}

describe('animationStateSystem', () => {
  it('parado e no chão → idle', () => {
    const { world, player } = makeWorld()
    player.add(Grounded)

    expect(resolve(world, player)).toBe('idle')
  })

  it('andando devagar e no chão → walk', () => {
    const { world, player } = makeWorld()
    player.add(Grounded)
    player.set(Velocity, { x: 3, z: 0 })

    expect(resolve(world, player)).toBe('walk')
  })

  it('rápido e no chão → run', () => {
    const { world, player } = makeWorld()
    player.add(Grounded)
    player.set(Velocity, { x: 7, z: 0 })

    expect(resolve(world, player)).toBe('run')
  })

  it('no ar (sem Grounded) → idle, mesmo se rápido', () => {
    const { world, player } = makeWorld()
    player.set(Velocity, { x: 7, z: 0 })

    expect(resolve(world, player)).toBe('idle')
  })
})
