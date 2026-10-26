import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { createParticleSystem } from './particleEmitter'
import { GUST_EMITTERS, GUST_TEXTURE_PATHS, GUST_TRAVEL } from './gustVfx'
import { getSkill } from '@/core/data/skills'
import { ATTACK_SOUND_COMPOSITES } from '@/core/data/audio/attackSound'

const byId = (id) => GUST_EMITTERS.find((spec) => spec.id === id)
const end = (spec) =>
  spec.start + (spec.duration ?? 0) + spec.lifetime({}, Array(10).fill(1))

describe('gustVfx — o vento do Gust', () => {
  it('só usa texturas que existem', () => {
    for (const spec of GUST_EMITTERS) {
      expect(GUST_TEXTURE_PATHS[spec.texture]).toBeDefined()
    }
  })

  it('o acerto vem quando o vento chega, junto do som do alvo', () => {
    expect(byId('puffs').start).toBeCloseTo(GUST_TRAVEL)
    expect(byId('swirl').start).toBeCloseTo(GUST_TRAVEL)
    const target = ATTACK_SOUND_COMPOSITES.gust.find((part) =>
      part.group.endsWith('-target'),
    )
    expect(target.delay).toBeCloseTo(GUST_TRAVEL)
  })

  it('o tempo do efeito no golpe cobre todas as partículas', () => {
    const { effectVisualDuration } = getSkill('gust').visual
    for (const spec of GUST_EMITTERS) {
      expect(effectVisualDuration).toBeGreaterThanOrEqual(end(spec))
    }
  })

  it('as lufadas ficam mais fortes com o alvo mais longe', () => {
    const wind = byId('wind')
    expect(wind.speed({ length: 6, age: 0 })).toBeGreaterThan(
      wind.speed({ length: 2, age: 0 }),
    )
  })

  it('solta o vento e depois o acerto', () => {
    const textures = Object.fromEntries(
      Object.keys(GUST_TEXTURE_PATHS).map((key) => [key, new THREE.Texture()]),
    )
    const system = createParticleSystem({
      emitters: GUST_EMITTERS,
      textures,
      length: 4,
      radius: 0.35,
    })
    system.update(0.05)
    const early = system.group.children.filter((c) => c.visible).length
    expect(early).toBeGreaterThan(0)
    system.update(GUST_TRAVEL)
    const later = system.group.children.filter((c) => c.visible).length
    expect(later).toBeGreaterThan(early)
    system.dispose()
  })
})
