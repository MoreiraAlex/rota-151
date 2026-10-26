import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { createParticleSystem } from './particleEmitter'
import {
  GLARE_DELAY,
  GLARE_GLEAM_EMITTERS,
  GLARE_TARGET_EMITTERS,
  GLARE_TEXTURE_PATHS,
  PARALYSIS_BODY_EMITTERS,
} from './glareVfx'
import { getSkill, resolveSkill } from '@/core/data/skills'
import { ATTACK_SOUND_COMPOSITES } from '@/core/data/audio/attackSound'

const ALL = [
  ...GLARE_GLEAM_EMITTERS,
  ...GLARE_TARGET_EMITTERS,
  ...PARALYSIS_BODY_EMITTERS,
]
const textures = () =>
  Object.fromEntries(
    Object.keys(GLARE_TEXTURE_PATHS).map((key) => [key, new THREE.Texture()]),
  )
const BODY = { width: 0.4, length: 1.2, height: 0.3 }
const visibleCount = (system) =>
  system.group.children.filter((child) => child.visible).length

describe('glareVfx — o Glare e a paralisia', () => {
  it('só usa texturas que existem', () => {
    for (const spec of ALL) {
      expect(GLARE_TEXTURE_PATHS[spec.texture]).toBeDefined()
    }
  })

  it('o brilho cabe entre o efeito e o fim da ação', () => {
    const glare = resolveSkill('glare')
    for (const spec of GLARE_GLEAM_EMITTERS) {
      expect(glare.effectAt + spec.start + spec.lifetime()).toBeLessThanOrEqual(
        glare.duration,
      )
    }
  })

  it('no alvo, nada antes do olhar chegar; depois, o rosto e as faíscas', () => {
    const system = createParticleSystem({
      emitters: GLARE_TARGET_EMITTERS,
      textures: textures(),
      length: 0,
      radius: 0.5,
      body: BODY,
    })
    system.update(GLARE_DELAY / 2)
    expect(visibleCount(system)).toBe(0)
    system.update(GLARE_DELAY)
    expect(visibleCount(system)).toBeGreaterThan(1)
    system.dispose()
  })

  it('o tempo do efeito no alvo cobre o rosto', () => {
    const end = Math.max(
      ...GLARE_TARGET_EMITTERS.map(
        (spec) => spec.start + (spec.duration ?? 0) + spec.lifetime(),
      ),
    )
    expect(
      getSkill('glare').visual.targetEffectVisualDuration,
    ).toBeGreaterThanOrEqual(end)
  })

  it('o som da paralisia espera o olhar chegar, como o visual', () => {
    const target = ATTACK_SOUND_COMPOSITES.glare.find(
      (part) => part.group === 'paralysis-target',
    )
    expect(target.delay).toBeCloseTo(GLARE_DELAY)
  })

  it('paralisado, as faíscas voltam de tempos em tempos', () => {
    const system = createParticleSystem({
      emitters: PARALYSIS_BODY_EMITTERS,
      textures: textures(),
      length: 0,
      radius: 0.5,
      body: BODY,
    })
    const every = PARALYSIS_BODY_EMITTERS[0].every
    let seenLater = 0
    for (let t = 0; t < every * 2.2; t += 0.05) {
      system.update(0.05)
      if (t > every) seenLater = Math.max(seenLater, visibleCount(system))
    }
    expect(seenLater).toBeGreaterThan(0)
    system.dispose()
  })
})
