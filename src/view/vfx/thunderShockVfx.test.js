import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { createParticleSystem } from './particleEmitter'
import { particleSize, frameAt } from './particleSimulation'
import {
  THUNDER_SHOCK_CHARGE_EMITTERS,
  THUNDER_SHOCK_EMITTERS,
  THUNDER_SHOCK_TEXTURE_PATHS,
} from './thunderShockVfx'
import { getSkill } from '@/core/data/skills'

const byId = (id) => THUNDER_SHOCK_EMITTERS.find((spec) => spec.id === id)
const textures = () =>
  Object.fromEntries(
    Object.keys(THUNDER_SHOCK_TEXTURE_PATHS).map((key) => [
      key,
      new THREE.Texture(),
    ]),
  )

describe('thunderShockVfx — o Thunder Shock', () => {
  it('só usa texturas que existem', () => {
    for (const spec of [
      ...THUNDER_SHOCK_CHARGE_EMITTERS,
      ...THUNDER_SHOCK_EMITTERS,
    ]) {
      expect(THUNDER_SHOCK_TEXTURE_PATHS[spec.texture]).toBeDefined()
    }
  })

  it('o raio vai do tamanho do golpe: mais longe, mais comprido', () => {
    const bolt = byId('bolt')
    const sizeAt = (length) =>
      particleSize(bolt, {
        age: bolt.lifetime() / 2,
        life: bolt.lifetime(),
        rnd: [],
        body: null,
        length,
        scale: 1,
      })[0]
    expect(sizeAt(4)).toBeCloseTo(sizeAt(2) * 2)
  })

  it('o raio pisca em loop, sem parar no último quadro', () => {
    const { frames } = byId('bolt')
    const period = frames.count / frames.fps
    expect(frameAt(period * 1.5, frames, 1)).toBe(
      frameAt(period * 0.5, frames, 1),
    )
  })

  it('o tempo do efeito no golpe cobre tudo', () => {
    const end = Math.max(
      ...THUNDER_SHOCK_EMITTERS.map(
        (spec) => spec.start + spec.lifetime({}, Array(10).fill(1)),
      ),
    )
    expect(
      getSkill('thunder-shock').visual.effectVisualDuration,
    ).toBeGreaterThanOrEqual(end)
  })

  it('no acerto, o raio e o impacto saem juntos', () => {
    const system = createParticleSystem({
      emitters: THUNDER_SHOCK_EMITTERS,
      textures: textures(),
      length: 3,
      radius: 0.35,
    })
    system.update(0.01)
    const visible = system.group.children.filter((child) => child.visible)
    expect(visible.length).toBeGreaterThan(THUNDER_SHOCK_EMITTERS.length)
    system.dispose()
  })
})
