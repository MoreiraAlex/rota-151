import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { createParticleSystem } from './particleEmitter'
import {
  STRING_SHOT_EMITTERS,
  STRING_SHOT_TARGET_EMITTERS,
  STRING_SHOT_TEXTURE_PATHS,
  STRING_SHOT_WEB_EMITTERS,
} from './stringShotVfx'

const SETS = {
  golpe: STRING_SHOT_EMITTERS,
  alvo: STRING_SHOT_TARGET_EMITTERS,
  teia: STRING_SHOT_WEB_EMITTERS,
}

function run(emitters, { radius = 1, scale = 1 } = {}) {
  const textures = Object.fromEntries(
    Object.keys(STRING_SHOT_TEXTURE_PATHS).map((key) => [
      key,
      new THREE.Texture(),
    ]),
  )
  return createParticleSystem({
    emitters,
    textures,
    length: 3,
    radius,
    scale,
    random: Math.random,
  })
}

describe('stringShotVfx — fios e teia do String Shot', () => {
  it.each(Object.entries(SETS))(
    '%s: só usa texturas que existem e solta partículas',
    (_, emitters) => {
      for (const spec of emitters) {
        expect(STRING_SHOT_TEXTURE_PATHS[spec.texture]).toBeDefined()
      }
      const system = run(emitters)
      for (let i = 0; i < 60; i++) system.update(1 / 30)
      expect(system.group.children.some((child) => child.visible)).toBe(true)
      system.dispose()
    },
  )

  it('a teia do corpo dura enquanto o efeito durar (emissão contínua)', () => {
    for (const spec of STRING_SHOT_WEB_EMITTERS) {
      expect(spec.continuous).toBe(true)
    }
  })

  it('todos os fios nascem no mesmo ponto da boca e crescem dali', () => {
    const length = 3
    const system = run(
      STRING_SHOT_EMITTERS.filter((spec) => spec.id === 'threads'),
    )
    let checked = 0
    for (let i = 0; i < 20; i++) {
      system.update(1 / 30)
      for (const child of system.group.children) {
        if (!child.visible) continue
        // a ponta de trás: o centro menos meio comprimento no eixo do quadro
        const axis = new THREE.Vector3(1, 0, 0).applyQuaternion(
          child.quaternion,
        )
        const tail = child.position
          .clone()
          .addScaledVector(axis, -child.scale.x / 2)
        expect(tail.x).toBeCloseTo(0, 1)
        expect(tail.y).toBeCloseTo(0, 1)
        expect(tail.z).toBeCloseTo(-length, 1)
        checked += 1
      }
    }
    expect(checked).toBeGreaterThan(0)
    system.dispose()
  })

  it.each([
    ['alvo', STRING_SHOT_TARGET_EMITTERS, 'wrap'],
    ['teia', STRING_SHOT_WEB_EMITTERS, 'web'],
  ])('%s: o anel acompanha o tamanho do corpo', (_, emitters, id) => {
    const spec = emitters.find((emitter) => emitter.id === id)
    const rnd = Array(10).fill(0.5)
    const small = { width: 0.4, length: 0.8, height: 0.4 }
    const big = { width: 2, length: 6, height: 3 }
    const [smallFront, smallSide] = spec.size(0.5, rnd, small)
    const [bigFront, bigSide] = spec.size(0.5, rnd, big)
    expect(bigSide / smallSide).toBeCloseTo(big.width / small.width)
    expect(bigFront / smallFront).toBeCloseTo(big.length / small.length)
  })

  it('os fios do golpe ficam dentro do leque do cone', () => {
    const radius = 1.5
    const system = run(STRING_SHOT_EMITTERS, { radius })
    for (let i = 0; i < 30; i++) system.update(1 / 30)
    // espaço local: +Z na direção do golpe, a boca em (0, 0, -length)
    for (const child of system.group.children) {
      if (!child.visible) continue
      const along = child.position.z + 3
      expect(Math.abs(child.position.x)).toBeLessThanOrEqual(
        (radius / 3) * Math.max(along, 0) + 0.5,
      )
    }
    system.dispose()
  })
})
