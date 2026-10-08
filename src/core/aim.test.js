import { describe, it, expect } from 'vitest'
import { resolveArcLaunch } from './aim'

const SPEED = 15
const GRAVITY = -18

/** Onde o arco passa ao chegar na distância horizontal do alvo. */
function heightAtTarget(origin, target, velocity) {
  const horizontal = Math.hypot(target.x - origin.x, target.z - origin.z)
  const t = horizontal / Math.hypot(velocity.x, velocity.z)
  return origin.y + velocity.y * t + 0.5 * GRAVITY * t * t
}

describe('resolveArcLaunch', () => {
  it('dentro do alcance, o arco passa pelo ponto de mira', () => {
    const origin = { x: 0, y: 1.5, z: 0 }
    for (const target of [
      { x: 0, y: 0.5, z: 6 },
      { x: 4, y: 2, z: 4 },
      { x: -3, y: 0, z: 8 },
    ]) {
      const velocity = resolveArcLaunch(origin, target, SPEED, GRAVITY)
      expect(Math.hypot(velocity.x, velocity.y, velocity.z)).toBeCloseTo(SPEED)
      expect(heightAtTarget(origin, target, velocity)).toBeCloseTo(target.y, 4)
    }
  })

  it('aponta pra direção do alvo no plano', () => {
    const velocity = resolveArcLaunch(
      { x: 0, y: 0, z: 0 },
      { x: 3, y: 0, z: 4 },
      SPEED,
      GRAVITY,
    )
    expect(velocity.x / velocity.z).toBeCloseTo(3 / 4)
  })

  it('fora do alcance, sai no ângulo de alcance máximo', () => {
    const velocity = resolveArcLaunch(
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 0, z: 1000 },
      SPEED,
      GRAVITY,
    )
    expect(velocity.y).toBeCloseTo(velocity.z)
    expect(Math.hypot(velocity.x, velocity.y, velocity.z)).toBeCloseTo(SPEED)
  })
})
