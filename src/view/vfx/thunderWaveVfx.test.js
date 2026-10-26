import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { createParticleSystem } from './particleEmitter'
import {
  THUNDER_WAVE_EMITTERS,
  THUNDER_WAVE_TEXTURE_PATHS,
  WAVE_TRAVEL,
} from './thunderWaveVfx'
import { getSkill } from '@/core/data/skills'
import { ATTACK_SOUND_COMPOSITES } from '@/core/data/audio/attackSound'

const textures = () =>
  Object.fromEntries(
    Object.keys(THUNDER_WAVE_TEXTURE_PATHS).map((key) => [
      key,
      new THREE.Texture(),
    ]),
  )
const atImpact = THUNDER_WAVE_EMITTERS.filter(
  (spec) => spec.anchor === 'impact',
)

describe('thunderWaveVfx — o Thunder Wave', () => {
  it('só usa texturas que existem', () => {
    for (const spec of THUNDER_WAVE_EMITTERS) {
      expect(THUNDER_WAVE_TEXTURE_PATHS[spec.texture]).toBeDefined()
    }
  })

  it('o que acontece no alvo espera a onda chegar', () => {
    expect(atImpact.length).toBeGreaterThan(0)
    for (const spec of atImpact)
      expect(spec.start).toBeGreaterThanOrEqual(WAVE_TRAVEL)
  })

  it('o som do alvo espera a onda, como o visual', () => {
    const target = ATTACK_SOUND_COMPOSITES['thunder-wave'].find(
      (part) => part.group === 'thunder-wave-target',
    )
    expect(target.delay).toBeCloseTo(WAVE_TRAVEL)
  })

  it('o tempo do efeito no golpe cobre tudo', () => {
    const end = Math.max(
      ...THUNDER_WAVE_EMITTERS.map(
        (spec) => spec.start + (spec.duration ?? 0) + spec.lifetime(),
      ),
    )
    expect(
      getSkill('thunder-wave').visual.effectVisualDuration,
    ).toBeGreaterThanOrEqual(end)
  })

  it('os anéis ficam de pé, de frente pro golpe, mesmo andando pra frente', () => {
    const system = createParticleSystem({
      emitters: THUNDER_WAVE_EMITTERS.filter((spec) => spec.id === 'wave'),
      textures: textures(),
      length: 3,
      radius: 0.35,
    })
    system.update(0.05)
    const ring = system.group.children.find((child) => child.visible)
    // a face do quadro (+Z local) aponta pra +Z do golpe
    const face = new THREE.Vector3(0, 0, 1).applyQuaternion(ring.quaternion)
    expect(Math.abs(face.z)).toBeCloseTo(1)
    system.dispose()
  })
})
