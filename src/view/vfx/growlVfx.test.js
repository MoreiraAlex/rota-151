import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { createParticleSystem } from './particleEmitter'
import {
  GROWL_EMITTERS,
  GROWL_TEXTURE_PATHS,
  WAVE_COUNT,
  WAVE_INTERVAL,
  WAVE_LIFETIME,
} from './growlVfx'
import { resolveSkill } from '@/core/data/skills'

function run(length = 3) {
  const textures = Object.fromEntries(
    Object.keys(GROWL_TEXTURE_PATHS).map((key) => [key, new THREE.Texture()]),
  )
  const system = createParticleSystem({
    emitters: GROWL_EMITTERS,
    textures,
    length,
    radius: 1.5,
    random: () => 0.5,
  })
  return system
}

describe('growlVfx — ondas sonoras do Growl', () => {
  it('tem uma onda por emissor, escalonadas no tempo, nascendo na boca', () => {
    expect(GROWL_EMITTERS).toHaveLength(WAVE_COUNT)
    GROWL_EMITTERS.forEach((spec, index) => {
      expect(spec.start).toBeCloseTo(index * WAVE_INTERVAL)
      expect(spec.anchor).toBe('origin')
      expect(spec.facing).toBe('direction')
    })
  })

  it('a onda sai da boca, chega à ponta do cone e alarga o arco', () => {
    const system = run(3)
    system.update(0.01)
    const [wave] = system.group.children.filter((child) => child.visible)
    expect(wave.position.z).toBeCloseTo(-3 + 0.01 * (3 / WAVE_LIFETIME), 1)
    const heightStart = wave.scale.y

    system.update(WAVE_LIFETIME * 0.9)
    const later = system.group.children.find((c) => c.visible)
    expect(later.position.z).toBeGreaterThan(-0.6)
    expect(later.scale.y).toBeGreaterThan(heightStart)
  })

  it('termina sozinho depois da última onda', () => {
    const system = run()
    for (let t = 0; t < 2; t += 0.05) system.update(0.05)
    expect(system.isDone()).toBe(true)
  })

  it('a duração visual da skill cobre a última onda', () => {
    const total = (WAVE_COUNT - 1) * WAVE_INTERVAL + WAVE_LIFETIME
    expect(
      resolveSkill('growl').visual.effectVisualDuration,
    ).toBeGreaterThanOrEqual(total)
  })
})
