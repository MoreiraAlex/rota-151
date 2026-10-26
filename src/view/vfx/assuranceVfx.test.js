import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { createParticleSystem } from './particleEmitter'
import { ASSURANCE_EMITTERS, ASSURANCE_TEXTURE_PATHS } from './assuranceVfx'
import { getSkill } from '@/core/data/skills'

const byId = (id) => ASSURANCE_EMITTERS.find((spec) => spec.id === id)
const marks = ASSURANCE_EMITTERS.filter((spec) => spec.id.startsWith('mark'))

describe('assuranceVfx — o acerto do Assurance', () => {
  it('só usa texturas que existem', () => {
    for (const spec of ASSURANCE_EMITTERS) {
      expect(ASSURANCE_TEXTURE_PATHS[spec.texture]).toBeDefined()
    }
  })

  it('o golpe e os pontos vêm depois da primeira marca', () => {
    expect(byId('hit').start).toBeGreaterThan(marks[0].start)
    expect(byId('dots').start).toBe(byId('hit').start)
  })

  it('o tempo do efeito no golpe cobre tudo', () => {
    const end = Math.max(
      ...ASSURANCE_EMITTERS.map((spec) => spec.start + spec.lifetime()),
    )
    expect(
      getSkill('assurance').visual.effectVisualDuration,
    ).toBeGreaterThanOrEqual(end)
  })

  it('solta a marca e depois o golpe com os pontos', () => {
    const textures = Object.fromEntries(
      Object.keys(ASSURANCE_TEXTURE_PATHS).map((key) => [
        key,
        new THREE.Texture(),
      ]),
    )
    const system = createParticleSystem({
      emitters: ASSURANCE_EMITTERS,
      textures,
      length: 0,
      radius: 0.5,
    })
    const visible = () =>
      system.group.children.filter((child) => child.visible).length
    system.update(0.01)
    expect(visible()).toBe(1)
    system.update(byId('hit').start)
    expect(visible()).toBeGreaterThan(marks.length)
    system.dispose()
  })
})
