import { describe, expect, it } from 'vitest'
import { resolveFlightLift } from './flightLiftSystem'

const HEIGHT = 0.2
const SPEED = 5
const DELTA = 1 / 60

describe('resolveFlightLift', () => {
  it('andando ou correndo, sobe em direção à altura de voo', () => {
    for (const state of ['walk', 'run']) {
      const next = resolveFlightLift(0, HEIGHT, state, DELTA, SPEED)
      expect(next).toBeGreaterThan(0)
      expect(next).toBeLessThan(HEIGHT)
    }
  })

  it('fora de andar/correr, desce em direção ao chão', () => {
    for (const state of ['idle', 'attack', 'jump', null]) {
      const next = resolveFlightLift(HEIGHT, HEIGHT, state, DELTA, SPEED)
      expect(next).toBeLessThan(HEIGHT)
      expect(next).toBeGreaterThan(0)
    }
  })

  it('nunca passa do alvo, mesmo com um passo grande', () => {
    expect(resolveFlightLift(0, HEIGHT, 'walk', 10, SPEED)).toBe(HEIGHT)
    expect(resolveFlightLift(HEIGHT, HEIGHT, 'idle', 10, SPEED)).toBe(0)
  })

  it('chega na altura de voo com o tempo', () => {
    let lift = 0
    for (let i = 0; i < 600; i++) {
      lift = resolveFlightLift(lift, HEIGHT, 'run', DELTA, SPEED)
    }
    expect(lift).toBeCloseTo(HEIGHT)
  })
})
