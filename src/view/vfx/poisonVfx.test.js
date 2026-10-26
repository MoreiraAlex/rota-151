import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { createParticleSystem } from './particleEmitter'
import {
  POISON_BODY_EMITTERS,
  POISON_STING_EMITTERS,
  POISON_TEXTURE_PATHS,
  STING_TRAVEL,
} from './poisonVfx'
import { getSkill } from '@/core/data/skills'

const byId = (id) => POISON_STING_EMITTERS.find((spec) => spec.id === id)

function run(emitters, length = 4) {
  const textures = Object.fromEntries(
    Object.keys(POISON_TEXTURE_PATHS).map((key) => [key, new THREE.Texture()]),
  )
  return createParticleSystem({ emitters, textures, length, radius: 0.35 })
}

describe('poisonVfx — o ferrão e o veneno', () => {
  it('só usa texturas que existem', () => {
    for (const spec of [...POISON_STING_EMITTERS, ...POISON_BODY_EMITTERS]) {
      expect(POISON_TEXTURE_PATHS[spec.texture]).toBeDefined()
    }
  })

  it('o ferrão sai da criatura e chega ao alvo quando o respingo começa', () => {
    const length = 4
    const stinger = byId('stinger')
    expect(stinger.speed({ length }) * stinger.lifetime()).toBeCloseTo(length)
    expect(byId('splash').start).toBeCloseTo(STING_TRAVEL)
    expect(byId('bubbles').start).toBeCloseTo(STING_TRAVEL)
  })

  it('o tempo do efeito no golpe cobre as bolhas', () => {
    const bubbles = byId('bubbles')
    const longest = bubbles.lifetime({}, Array(10).fill(1))
    expect(
      getSkill('poison-sting').visual.effectVisualDuration,
    ).toBeGreaterThanOrEqual(bubbles.start + longest)
  })

  it('as bolhas no corpo continuam enquanto dura e crescem com o corpo', () => {
    for (const spec of POISON_BODY_EMITTERS) {
      expect(spec.continuous).toBe(true)
    }
    const [bubbles] = POISON_BODY_EMITTERS
    const rnd = Array(10).fill(0.5)
    const small = bubbles.size(0.5, rnd, { width: 0.4, length: 0.4, height: 1 })
    const big = bubbles.size(0.5, rnd, { width: 2, length: 2, height: 1 })
    expect(big / small).toBeCloseTo(2 / 0.4)
  })

  it('solta partículas no golpe e no corpo', () => {
    for (const emitters of [POISON_STING_EMITTERS, POISON_BODY_EMITTERS]) {
      const system = run(emitters)
      for (let i = 0; i < 20; i++) system.update(1 / 30)
      expect(system.group.children.some((child) => child.visible)).toBe(true)
      system.dispose()
    }
  })
})
