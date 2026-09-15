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

  it('mirando (input.aiming), o mouse não mexe mais no yaw/pitch — congelado pro lock-on (cameraFollowSystem.js gira sozinho)', () => {
    const { tick, orbit } = setup()
    const beforeYaw = orbit().yaw
    const beforePitch = orbit().pitch

    tick({ cameraYaw: 50, cameraPitch: 30, aiming: true })

    expect(orbit().yaw).toBe(beforeYaw)
    expect(orbit().pitch).toBe(beforePitch)
  })

  it('mirando, o zoom continua livre', () => {
    const { tick, orbit } = setup()
    const before = orbit().distance

    tick({ zoom: 1, aiming: true })

    expect(orbit().distance).toBeGreaterThan(before)
  })

  it('soltar a mira volta a aceitar deltas de mouse normalmente, sem salto', () => {
    const { tick, orbit } = setup()
    tick({ cameraYaw: 50, aiming: true }) // congelado, não muda
    const frozenYaw = orbit().yaw

    tick({ cameraYaw: 50, aiming: false })

    expect(orbit().yaw).toBeLessThan(frozenYaw) // agora sim gira
  })
})
