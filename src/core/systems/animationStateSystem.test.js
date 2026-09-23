import { describe, it, expect } from 'vitest'
import { makeWorld } from '@/test/makeWorld'
import { Velocity, AnimationState, ActionState, Grounded } from '@/core/traits'
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

  it('no ar (sem Grounded) → fall, mesmo se rápido', () => {
    const { world, player } = makeWorld()
    player.set(Velocity, { x: 7, z: 0 })

    expect(resolve(world, player)).toBe('fall')
  })

  it('ação "dash" em andamento vence a locomoção, mesmo parado e no ar', () => {
    const { world, player } = makeWorld()
    player.set(ActionState, { current: 'dash' })

    expect(resolve(world, player)).toBe('dash')
  })

  it('ação "dash" vence mesmo com velocidade de corrida e no chão', () => {
    const { world, player } = makeWorld()
    player.add(Grounded)
    player.set(Velocity, { x: 7, z: 0 })
    player.set(ActionState, { current: 'dash' })

    expect(resolve(world, player)).toBe('dash')
  })
})
