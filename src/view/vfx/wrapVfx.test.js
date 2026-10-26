import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { createParticleSystem } from './particleEmitter'
import {
  WRAP_BODY_EMITTERS,
  WRAP_TARGET_EMITTERS,
  WRAP_TEXTURE_PATHS,
} from './wrapVfx'
import { getSkill } from '@/core/data/skills'

const textures = () => ({ wrap: new THREE.Texture() })
const BODY = { width: 0.4, length: 1.2, height: 0.3 }

describe('wrapVfx — os anéis do Wrap', () => {
  it('só usa texturas que existem', () => {
    for (const spec of [...WRAP_TARGET_EMITTERS, ...WRAP_BODY_EMITTERS]) {
      expect(WRAP_TEXTURE_PATHS[spec.texture]).toBeDefined()
    }
  })

  it('no acerto, o anel chega largo e aperta até o tamanho do corpo', () => {
    const spec = WRAP_TARGET_EMITTERS[0]
    const [startFront, startSide] = spec.size(0, [], BODY)
    const [endFront, endSide] = spec.size(1, [], BODY)
    expect(startFront).toBeGreaterThan(endFront)
    expect(startSide).toBeGreaterThan(endSide)
    // encostado: um pouco maior que o corpo, na proporção dele
    expect(endFront).toBeGreaterThan(BODY.length)
    expect(endSide).toBeGreaterThan(BODY.width)
    expect(endFront / endSide).toBeCloseTo(BODY.length / BODY.width)
  })

  it('o tempo do efeito no golpe cobre os anéis', () => {
    const end = Math.max(
      ...WRAP_TARGET_EMITTERS.map((spec) => spec.start + spec.lifetime()),
    )
    expect(
      getSkill('wrap').visual.targetEffectVisualDuration,
    ).toBeGreaterThanOrEqual(end)
  })

  it('preso, os anéis continuam no corpo enquanto dura', () => {
    const system = createParticleSystem({
      emitters: WRAP_BODY_EMITTERS,
      textures: textures(),
      length: 0,
      radius: 0.5,
      body: BODY,
    })
    for (let i = 0; i < 60; i++) system.update(0.05)
    const visible = system.group.children.filter((child) => child.visible)
    expect(visible.length).toBeGreaterThanOrEqual(WRAP_BODY_EMITTERS.length)
    system.dispose()
  })
})
