import { describe, it, expect } from 'vitest'
import { GAME_CONFIG } from '@/core/gameConfig'
import * as THREE from 'three'
import { createWorld } from 'koota'
import { FlightStats, Flying, Velocity } from '@/core/traits'
import { registerView, unregisterView } from '@/view/registry/viewRegistry'
import { flightTiltSystem, resolveFlightTilt } from './flightTiltSystem'

const TILT = GAME_CONFIG.FLIGHT.TILT
const LEVEL = { roll: 0, pitch: 0 }
const SPEED = 4
const ahead = { x: 0, y: 0, z: SPEED }

/** Roda até assentar (bem mais que o tempo da suavização). */
function settle(input, current = LEVEL) {
  let state = current
  for (let i = 0; i < 600; i++) state = resolveFlightTilt(state, input, 1 / 60)
  return state
}

describe('resolveFlightTilt', () => {
  it('voando reto, sem curva: fica nivelado', () => {
    const tilt = settle({
      flying: true,
      turnRate: 0,
      vel: ahead,
      flightSpeed: SPEED,
    })
    expect(tilt.roll).toBeCloseTo(0)
    expect(tilt.pitch).toBeCloseTo(0)
  })

  it('curva pra esquerda deita pra um lado; pra direita, pro outro', () => {
    const left = settle({
      flying: true,
      turnRate: 1,
      vel: ahead,
      flightSpeed: SPEED,
    })
    const right = settle({
      flying: true,
      turnRate: -1,
      vel: ahead,
      flightSpeed: SPEED,
    })
    expect(left.roll).toBeLessThan(0)
    expect(right.roll).toBeCloseTo(-left.roll)
  })

  it('a curva nunca deita mais que MAX_ROLL', () => {
    const tilt = settle({
      flying: true,
      turnRate: 100,
      vel: ahead,
      flightSpeed: SPEED,
    })
    expect(Math.abs(tilt.roll)).toBeCloseTo(TILT.MAX_ROLL)
  })

  it('subindo pra frente levanta o bico; descendo abaixa', () => {
    const climbing = settle({
      flying: true,
      turnRate: 0,
      vel: { x: 0, y: 2, z: SPEED },
      flightSpeed: SPEED,
    })
    const diving = settle({
      flying: true,
      turnRate: 0,
      vel: { x: 0, y: -2, z: SPEED },
      flightSpeed: SPEED,
    })
    expect(climbing.pitch).toBeGreaterThan(0)
    expect(diving.pitch).toBeLessThan(0)
    expect(climbing.pitch).toBeLessThanOrEqual(TILT.MAX_PITCH)
  })

  it('subindo reto (sem ir pra frente) ou descendo pairado: o bico não aponta', () => {
    const tilt = settle({
      flying: true,
      turnRate: 0,
      vel: { x: 0, y: -1.5, z: 0 },
      flightSpeed: SPEED,
    })
    expect(tilt.pitch).toBeCloseTo(0)
  })

  it('fora do voo volta a nivelar, suave', () => {
    const banked = { roll: TILT.MAX_ROLL, pitch: TILT.MAX_PITCH }
    const next = resolveFlightTilt(
      banked,
      { flying: false, turnRate: 0, vel: ahead, flightSpeed: SPEED },
      1 / 60,
    )
    expect(next.roll).toBeLessThan(banked.roll)
    expect(next.roll).toBeGreaterThan(0)
    expect(
      settle(
        { flying: false, turnRate: 0, vel: ahead, flightSpeed: SPEED },
        banked,
      ).roll,
    ).toBeCloseTo(0)
  })
})

describe('flightTiltSystem (com o mundo do koota)', () => {
  it('inclina o grupo da entidade voando em curva, sem erro', () => {
    const world = createWorld()
    const bird = world.spawn(
      FlightStats({ speed: SPEED, fastSpeed: SPEED * 2 }),
      Velocity({ x: 0, y: 0, z: SPEED }),
      Flying,
    )
    const view = new THREE.Object3D()
    registerView(bird, view)

    for (let i = 0; i < 30; i++) {
      // o yaw que o syncTransformSystem poria, girando pra esquerda
      view.rotation.y += 0.02
      flightTiltSystem({ world, delta: 1 / 60 })
    }
    expect(view.rotation.order).toBe('YXZ')
    expect(view.rotation.z).toBeLessThan(0)

    unregisterView(bird)
    world.destroy()
  })
})
