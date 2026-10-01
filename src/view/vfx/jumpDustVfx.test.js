import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { createParticleSystem } from './particleEmitter'
import { buildJumpDustEmitters, JUMP_DUST_TEXTURE_PATHS } from './jumpDustVfx'

function run(options) {
  return createParticleSystem({
    emitters: buildJumpDustEmitters(options),
    textures: { smoke: new THREE.Texture() },
    length: 0,
    radius: 0,
    random: (() => {
      let i = 0
      return () => (i++ * 0.37) % 1
    })(),
  })
}

describe('jumpDustVfx', () => {
  it('usa a textura de fumaça do dash', () => {
    expect(JUMP_DUST_TEXTURE_PATHS.smoke).toMatch(/big_smoke/)
  })

  it('solta `count` nuvens de uma vez, que se afastam do ponto no plano do chão', () => {
    const system = run({ count: 8 })
    system.update(0.001)
    expect(system.liveCount).toBe(8)

    system.update(0.2)
    const far = system.group.children.filter(
      (c) => c.visible && Math.hypot(c.position.x, c.position.z) > 0.2,
    )
    expect(far.length).toBeGreaterThan(0)
  })

  it('termina sozinho', () => {
    const system = run({ count: 6 })
    for (let t = 0; t < 2; t += 0.05) system.update(0.05)
    expect(system.isDone()).toBe(true)
  })
})
