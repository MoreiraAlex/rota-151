import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { createParticleSystem } from './particleEmitter'
import {
  FURY_ATTACK_EMITTERS,
  FURY_ATTACK_TEXTURE_PATHS,
} from './furyAttackVfx'
import { getSkill } from '@/core/data/skills'

const textures = () =>
  Object.fromEntries(
    Object.keys(FURY_ATTACK_TEXTURE_PATHS).map((key) => [
      key,
      new THREE.Texture(),
    ]),
  )

// O ponto do corte de uma bicada (o efeito inteiro), com o sorteio dado.
function cutPosition(random) {
  const system = createParticleSystem({
    emitters: FURY_ATTACK_EMITTERS,
    textures: textures(),
    length: 0,
    radius: 0.5,
    random,
  })
  system.update(0.001)
  const cut = system.group.children.find((child) => child.visible)
  const position = cut.position.clone()
  system.dispose()
  return position
}

describe('furyAttackVfx — uma bicada do Fury Attack', () => {
  it('só usa texturas que existem', () => {
    for (const spec of FURY_ATTACK_EMITTERS) {
      expect(FURY_ATTACK_TEXTURE_PATHS[spec.texture]).toBeDefined()
    }
  })

  it('o tempo do efeito no golpe cobre a bicada', () => {
    const end = Math.max(
      ...FURY_ATTACK_EMITTERS.map((spec) => spec.start + spec.lifetime()),
    )
    expect(
      getSkill('fury-attack').visual.effectVisualDuration,
    ).toBeGreaterThanOrEqual(end)
  })

  it('bicadas diferentes caem em pontos diferentes', () => {
    const low = cutPosition(() => 0.1)
    const high = cutPosition(() => 0.9)
    expect(low.distanceTo(high)).toBeGreaterThan(0.1)
  })

  it('o corte e as faíscas de uma bicada saem do mesmo ponto', () => {
    let calls = 0
    // o sorteio do efeito muda de uma bicada pra outra; o das partículas não
    const system = createParticleSystem({
      emitters: FURY_ATTACK_EMITTERS,
      textures: textures(),
      length: 0,
      radius: 0.5,
      random: () => (calls++ < 4 ? 0.8 : 0.5),
    })
    system.update(0.0001)
    const visible = system.group.children.filter((child) => child.visible)
    expect(visible.length).toBeGreaterThan(1)
    for (const sprite of visible) {
      expect(sprite.position.x).toBeCloseTo(visible[0].position.x, 2)
      expect(sprite.position.y).toBeCloseTo(visible[0].position.y, 2)
    }
    system.dispose()
  })
})
