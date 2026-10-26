import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { createParticleSystem } from './particleEmitter'
import { BUG_BITE_EMITTERS, BUG_BITE_TEXTURE_PATHS } from './bugBiteVfx'
import { getSkill } from '@/core/data/skills'

const byId = (id) => BUG_BITE_EMITTERS.find((spec) => spec.id === id)

describe('bugBiteVfx — a mordida do Bug Bite', () => {
  it('só usa texturas que existem', () => {
    for (const spec of BUG_BITE_EMITTERS) {
      expect(BUG_BITE_TEXTURE_PATHS[spec.texture]).toBeDefined()
    }
  })

  it('as faíscas saem depois que a mordida começa, dentro da vida dela', () => {
    const fang = byId('fang')
    const sparks = byId('sparks')
    expect(sparks.start).toBeGreaterThan(fang.start)
    expect(sparks.start).toBeLessThan(fang.lifetime())
  })

  it('o tempo do efeito no golpe cobre as faíscas', () => {
    const sparks = byId('sparks')
    expect(
      getSkill('bug-bite').visual.effectVisualDuration,
    ).toBeGreaterThanOrEqual(sparks.start + sparks.lifetime())
  })

  it('solta a mordida e depois as faíscas', () => {
    const textures = Object.fromEntries(
      Object.keys(BUG_BITE_TEXTURE_PATHS).map((key) => [
        key,
        new THREE.Texture(),
      ]),
    )
    const system = createParticleSystem({
      emitters: BUG_BITE_EMITTERS,
      textures,
      length: 0,
      radius: 0.5,
    })
    system.update(0.01)
    const early = system.group.children.filter((child) => child.visible)
    expect(early).toHaveLength(1)
    system.update(byId('sparks').start)
    const later = system.group.children.filter((child) => child.visible)
    expect(later.length).toBeGreaterThan(1)
    system.dispose()
  })
})
