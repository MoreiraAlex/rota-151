import { describe, it, expect } from 'vitest'
import { makeWorld } from '@/test/makeWorld'
import {
  Velocity,
  AnimationState,
  ActionState,
  Grounded,
  Jumping,
} from '@/core/traits'
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

  it('pulo de verdade SUBINDO → jump; do ponto mais alto em diante → fall', () => {
    const { world, player } = makeWorld()
    player.add(Jumping)

    player.set(Velocity, { x: 0, y: 5, z: 0 })
    expect(resolve(world, player)).toBe('jump')

    player.set(Velocity, { x: 0, y: 0, z: 0 }) // ponto mais alto
    expect(resolve(world, player)).toBe('fall')

    player.set(Velocity, { x: 0, y: -5, z: 0 })
    expect(resolve(world, player)).toBe('fall')
  })

  it('logo após o disparo, ainda grounded mas subindo → jump (não walk/idle)', () => {
    const { world, player } = makeWorld()
    player.add(Grounded)
    player.add(Jumping)
    player.set(Velocity, { x: 3, y: 9, z: 0 })

    expect(resolve(world, player)).toBe('jump')
  })
})
