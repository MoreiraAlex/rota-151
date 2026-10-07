import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { createParticleSystem } from './particleEmitter'
import {
  EAT_FOOD_TEXTURE_PATHS,
  buildBiteEmitters,
  buildHealEmitters,
  buildLandEmitters,
} from './eatFoodVfx'

const textures = Object.fromEntries(
  Object.keys(EAT_FOOD_TEXTURE_PATHS).map((key) => [key, new THREE.Texture()]),
)

function run(emitters, { seconds = 3, setup } = {}) {
  const system = createParticleSystem({
    emitters,
    textures,
    length: 0,
    radius: 0,
  })
  setup?.(system)
  let peak = 0
  for (let i = 0; i < seconds * 60; i++) {
    system.update(1 / 60)
    peak = Math.max(peak, system.liveCount)
  }
  return { system, peak }
}

describe('eatFoodVfx', () => {
  it('a mordida solta suco e farelos e termina sozinha', () => {
    const { system, peak } = run(
      buildBiteEmitters({ color: '#be123c', juice: 4, crumbs: 2 }),
    )
    expect(peak).toBe(6)
    expect(system.isDone()).toBe(true)
  })

  it('o respingo solta as gotas e termina sozinho', () => {
    const { system, peak } = run(
      buildLandEmitters({ color: '#facc15', count: 3 }),
    )
    expect(peak).toBe(3)
    expect(system.isDone()).toBe(true)
  })

  it('a cura solta brilhos até acabar de comer', () => {
    const { system, peak } = run(buildHealEmitters({ rate: 6 }), {
      seconds: 2,
      setup: (s) => s.setFrame({ origin: [0, 0, 0], yaw: 0, height: 1 }),
    })
    expect(peak).toBeGreaterThan(0)
    expect(system.isDone()).toBe(false)

    system.endEmission()
    for (let i = 0; i < 3 * 60; i++) system.update(1 / 60)
    expect(system.isDone()).toBe(true)
  })
})
