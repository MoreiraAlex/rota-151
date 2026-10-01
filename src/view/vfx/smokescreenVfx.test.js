import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { createParticleSystem } from './particleEmitter'
import {
  SMOKESCREEN_EMITTERS,
  SMOKESCREEN_TARGET_EMITTERS,
  SMOKESCREEN_TEXTURE_PATHS,
} from './smokescreenVfx'
import { resolveSkill } from '@/core/data/skills'

function run(emitters, length = 3) {
  const textures = Object.fromEntries(
    Object.keys(SMOKESCREEN_TEXTURE_PATHS).map((key) => [
      key,
      new THREE.Texture(),
    ]),
  )
  return createParticleSystem({
    emitters,
    textures,
    length,
    radius: 1.5,
    random: () => 0.5,
  })
}

describe('smokescreenVfx — fumaça do Smokescreen', () => {
  it('o golpe solta o sopro da boca e a nuvem do cone', () => {
    const system = run(SMOKESCREEN_EMITTERS)
    system.update(0.05)
    expect(system.liveCount).toBeGreaterThan(90)
  })

  it('a nuvem do cone nasce espalhada entre a boca e a ponta (-length a 0)', () => {
    const random = (() => {
      let i = 0
      return () => (i++ * 0.37) % 1
    })()
    const textures = { smoke: new THREE.Texture() }
    const system = createParticleSystem({
      emitters: SMOKESCREEN_EMITTERS.filter((spec) => spec.id === 'cone'),
      textures,
      length: 3,
      radius: 1.5,
      random,
    })
    system.update(0.001)
    const zs = system.group.children.map((child) => child.position.z)
    expect(Math.min(...zs)).toBeLessThan(-2)
    expect(Math.max(...zs)).toBeGreaterThan(-1)
  })

  it('a fumaça do alvo nasce no corpo e termina sozinha', () => {
    const system = run(SMOKESCREEN_TARGET_EMITTERS, 0)
    system.update(0.1)
    expect(system.liveCount).toBeGreaterThan(0)
    for (let t = 0; t < 4; t += 0.05) system.update(0.05)
    expect(system.isDone()).toBe(true)
  })

  it('a skill baixa a PRECISÃO em cone, sem dano, e usa os dois grupos de VFX', () => {
    const skill = resolveSkill('smokescreen')
    expect(skill.damage).toBeNull()
    expect(skill.area).toBe('cone')
    expect(skill.effects[0]).toMatchObject({
      type: 'statStage',
      stat: 'accuracy',
    })
    expect(skill.effects[0].stages).toBeLessThan(0)
    expect(skill.visual.effectGroup).toBe('smokescreen')
    expect(skill.visual.targetEffectGroup).toBe('smokescreen-target')
  })
})
