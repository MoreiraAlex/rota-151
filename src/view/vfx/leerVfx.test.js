import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { createParticleSystem } from './particleEmitter'
import { LEER_EMITTERS, LEER_TEXTURE_PATHS } from './leerVfx'
import { resolveSkill } from '@/core/data/skills'

describe('leerVfx — o brilho no olho do Leer', () => {
  it('só usa texturas que existem', () => {
    for (const spec of LEER_EMITTERS) {
      expect(LEER_TEXTURE_PATHS[spec.texture]).toBeDefined()
    }
  })

  it('o brilho cabe entre o efeito e o fim da ação', () => {
    const leer = resolveSkill('leer')
    for (const spec of LEER_EMITTERS) {
      expect(leer.effectAt + spec.start + spec.lifetime()).toBeLessThanOrEqual(
        leer.duration,
      )
    }
  })

  it('solta um brilho em cada olho e eles somem', () => {
    const textures = { sparkle: new THREE.Texture() }
    const system = createParticleSystem({
      emitters: LEER_EMITTERS,
      textures,
      length: 0,
      radius: 0.5,
    })
    const visible = () =>
      system.group.children.filter((child) => child.visible).length
    system.update(0.01)
    expect(visible()).toBe(2)
    system.update(LEER_EMITTERS[0].lifetime())
    expect(visible()).toBe(0)
    system.dispose()
  })
})
