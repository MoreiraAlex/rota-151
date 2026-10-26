import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { createParticleSystem } from './particleEmitter'
import { PECK_EMITTERS, PECK_TEXTURE_PATHS } from './peckVfx'
import { getSkill } from '@/core/data/skills'

const byId = (id) => PECK_EMITTERS.find((spec) => spec.id === id)

describe('peckVfx — a bicada do Peck', () => {
  it('só usa texturas que existem', () => {
    for (const spec of PECK_EMITTERS) {
      expect(PECK_TEXTURE_PATHS[spec.texture]).toBeDefined()
    }
  })

  it('os cortes saem um depois do outro e o estouro depois deles', () => {
    expect(byId('cut-2').start).toBeGreaterThan(byId('cut-1').start)
    expect(byId('burst').start).toBeGreaterThan(byId('cut-2').start)
  })

  it('o tempo do efeito no golpe cobre o estouro', () => {
    const burst = byId('burst')
    const longest = burst.lifetime({}, Array(10).fill(1))
    expect(getSkill('peck').visual.effectVisualDuration).toBeGreaterThanOrEqual(
      burst.start + burst.duration + longest,
    )
  })

  it('solta o primeiro corte, depois o segundo e o estouro', () => {
    const textures = Object.fromEntries(
      Object.keys(PECK_TEXTURE_PATHS).map((key) => [key, new THREE.Texture()]),
    )
    const system = createParticleSystem({
      emitters: PECK_EMITTERS,
      textures,
      length: 0,
      radius: 0.5,
    })
    const visible = () =>
      system.group.children.filter((child) => child.visible).length
    system.update(0.01)
    expect(visible()).toBe(1)
    system.update(byId('cut-2').start)
    expect(visible()).toBe(2)
    system.update(byId('burst').duration)
    expect(visible()).toBeGreaterThan(2)
    system.dispose()
  })
})
