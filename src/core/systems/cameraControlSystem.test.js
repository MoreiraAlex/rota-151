import { describe, it, expect } from 'vitest'
import { makeWorld } from '@/test/makeWorld'
import { GAME_CONFIG } from '@/core/gameConfig'
import { OrbitCamera } from '@/core/traits'
import { cameraControlSystem } from './cameraControlSystem'

const CAM = GAME_CONFIG.CAMERA

function setup() {
  const { world, camera } = makeWorld()
  const tick = (input) =>
    cameraControlSystem({ world, delta: 1 / 60, input: input ?? {} })
  return { camera, tick, orbit: () => camera.get(OrbitCamera) }
}

describe('cameraControlSystem', () => {
  it('mouse para a direita diminui o yaw (gira a visão para a direita)', () => {
    const { tick, orbit } = setup()
    const before = orbit().yaw
    tick({ cameraYaw: 50 })
    expect(orbit().yaw).toBeLessThan(before)
  })

  it('o yaw é livre — não satura, normaliza em (-π, π]', () => {
    const { tick, orbit } = setup()
    for (let i = 0; i < 50; i++) tick({ cameraYaw: 200 })
    expect(orbit().yaw).toBeGreaterThan(-Math.PI)
    expect(orbit().yaw).toBeLessThanOrEqual(Math.PI)
  })

  it('o pitch satura em MIN_PITCH e MAX_PITCH', () => {
    const { tick, orbit } = setup()
    for (let i = 0; i < 200; i++) tick({ cameraPitch: 100 })
    expect(orbit().pitch).toBeCloseTo(CAM.MAX_PITCH)
    for (let i = 0; i < 400; i++) tick({ cameraPitch: -100 })
    expect(orbit().pitch).toBeCloseTo(CAM.MIN_PITCH)
  })

  it('o zoom satura em MIN_DISTANCE e MAX_DISTANCE', () => {
    const { tick, orbit } = setup()
    for (let i = 0; i < 100; i++) tick({ zoom: 1 })
    expect(orbit().distance).toBeCloseTo(CAM.MAX_DISTANCE)
    for (let i = 0; i < 100; i++) tick({ zoom: -1 })
    expect(orbit().distance).toBeCloseTo(CAM.MIN_DISTANCE)
  })
})
