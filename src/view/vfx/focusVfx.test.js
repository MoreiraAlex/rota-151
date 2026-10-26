import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { createParticleSystem } from './particleEmitter'
import {
  FOCUS_BODY_EMITTERS,
  FOCUS_ENERGY_EMITTERS,
  FOCUS_TEXTURE_PATHS,
} from './focusVfx'
import { STATUP_EMITTERS } from './statupVfx'

describe('focusVfx — o Focus Energy', () => {
  it('só usa texturas que existem', () => {
    for (const spec of [...FOCUS_ENERGY_EMITTERS, ...FOCUS_BODY_EMITTERS]) {
      expect(FOCUS_TEXTURE_PATHS[spec.texture]).toBeDefined()
    }
  })

  it('o uso é o "atributo subiu" com outra cor', () => {
    expect(FOCUS_ENERGY_EMITTERS).toHaveLength(STATUP_EMITTERS.length)
    FOCUS_ENERGY_EMITTERS.forEach((spec, i) => {
      expect(spec.id).toBe(STATUP_EMITTERS[i].id)
      expect(spec.tint).not.toBe(STATUP_EMITTERS[i].tint)
    })
  })

  it('as faíscas no corpo continuam enquanto dura e crescem com o corpo', () => {
    const [sparks] = FOCUS_BODY_EMITTERS
    expect(sparks.continuous).toBe(true)
    const rnd = Array(10).fill(0.5)
    const small = sparks.size(0.5, rnd, { width: 0.4, length: 0.4, height: 1 })
    const big = sparks.size(0.5, rnd, { width: 2, length: 2, height: 1 })
    expect(big / small).toBeCloseTo(2 / 0.4)
    const textures = Object.fromEntries(
      Object.keys(FOCUS_TEXTURE_PATHS).map((key) => [key, new THREE.Texture()]),
    )
    const system = createParticleSystem({
      emitters: FOCUS_BODY_EMITTERS,
      textures,
      length: 0,
      radius: 0.3,
    })
    for (let i = 0; i < 20; i++) system.update(1 / 30)
    expect(system.group.children.some((child) => child.visible)).toBe(true)
    system.dispose()
  })
})
