import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { createParticleSystem } from './particleEmitter'
import {
  SAND_ATTACK_EMITTERS,
  SAND_ATTACK_TARGET_EMITTERS,
  SAND_ATTACK_TEXTURE_PATHS,
  SAND_TRAVEL,
} from './sandAttackVfx'
import { getSkill } from '@/core/data/skills'
import { ATTACK_SOUND_COMPOSITES } from '@/core/data/audio/attackSound'

const ALL = [...SAND_ATTACK_EMITTERS, ...SAND_ATTACK_TARGET_EMITTERS]
const longest = (spec) => spec.start + spec.lifetime({}, Array(10).fill(1))

describe('sandAttackVfx — a areia do Sand Attack', () => {
  it('só usa texturas que existem', () => {
    for (const spec of ALL) {
      expect(SAND_ATTACK_TEXTURE_PATHS[spec.texture]).toBeDefined()
    }
  })

  it('o tempo dos efeitos no golpe cobre as partículas', () => {
    const { visual } = getSkill('sand-attack')
    for (const spec of SAND_ATTACK_EMITTERS) {
      expect(visual.effectVisualDuration).toBeGreaterThanOrEqual(longest(spec))
    }
    for (const spec of SAND_ATTACK_TARGET_EMITTERS) {
      expect(visual.targetEffectVisualDuration).toBeGreaterThanOrEqual(
        longest(spec),
      )
    }
  })

  it('o alvo reage quando a areia chega: grãos e som do acerto juntos', () => {
    for (const spec of SAND_ATTACK_TARGET_EMITTERS) {
      expect(spec.start).toBeGreaterThanOrEqual(SAND_TRAVEL)
    }
    const target = ATTACK_SOUND_COMPOSITES['sand-attack'].find((part) =>
      part.group.endsWith('-target'),
    )
    expect(target.delay).toBeCloseTo(SAND_TRAVEL)
  })

  it('o jato fica mais forte com o alvo mais longe', () => {
    const [spray] = SAND_ATTACK_EMITTERS
    const rnd = Array(10).fill(0.5)
    expect(spray.speed({ length: 6 }, rnd)).toBeGreaterThan(
      spray.speed({ length: 2 }, rnd),
    )
  })

  it('solta partículas no golpe e no alvo', () => {
    const textures = Object.fromEntries(
      Object.keys(SAND_ATTACK_TEXTURE_PATHS).map((key) => [
        key,
        new THREE.Texture(),
      ]),
    )
    for (const emitters of [
      SAND_ATTACK_EMITTERS,
      SAND_ATTACK_TARGET_EMITTERS,
    ]) {
      const system = createParticleSystem({
        emitters,
        textures,
        length: 4,
        radius: 0.35,
      })
      for (let i = 0; i < 15; i++) system.update(1 / 30)
      expect(system.group.children.some((child) => child.visible)).toBe(true)
      system.dispose()
    }
  })
})
