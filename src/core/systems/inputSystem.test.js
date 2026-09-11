import { describe, it, expect } from 'vitest'
import { makeWorld } from '@/test/makeWorld'
import { InputState } from '@/core/traits'
import { inputSystem } from './inputSystem'

function run(input) {
  const { world, player } = makeWorld()
  inputSystem({ world, delta: 1 / 60, input })
  return player.get(InputState)
}

describe('inputSystem', () => {
  it('sem input, a intenção é zero', () => {
    const state = run({})
    expect(state.x).toBe(0)
    expect(state.z).toBe(0)
  })

  it('forward move em -z, right move em +x', () => {
    expect(run({ forward: true })).toMatchObject({ x: 0, z: -1 })
    expect(run({ right: true })).toMatchObject({ x: 1, z: 0 })
    expect(run({ back: true })).toMatchObject({ x: 0, z: 1 })
    expect(run({ left: true })).toMatchObject({ x: -1, z: 0 })
  })

  it('eixos opostos se cancelam', () => {
    expect(run({ forward: true, back: true })).toMatchObject({ x: 0, z: 0 })
  })

  it('diagonais são normalizadas (magnitude ≤ 1)', () => {
    const state = run({ forward: true, right: true })
    const magnitude = Math.hypot(state.x, state.z)
    expect(magnitude).toBeCloseTo(1)
    expect(state.x).toBeCloseTo(Math.SQRT1_2)
    expect(state.z).toBeCloseTo(-Math.SQRT1_2)
  })
})
