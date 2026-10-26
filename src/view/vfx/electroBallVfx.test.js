import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { createParticleSystem } from './particleEmitter'
import {
  BALL_TRAVEL,
  ELECTRO_BALL_CHARGE_EMITTERS,
  ELECTRO_BALL_EMITTERS,
  ELECTRO_BALL_TEXTURE_PATHS,
} from './electroBallVfx'
import { getSkill } from '@/core/data/skills'
import { ATTACK_SOUND_COMPOSITES } from '@/core/data/audio/attackSound'

const textures = () =>
  Object.fromEntries(
    Object.keys(ELECTRO_BALL_TEXTURE_PATHS).map((key) => [
      key,
      new THREE.Texture(),
    ]),
  )
const byId = (id) => ELECTRO_BALL_EMITTERS.find((spec) => spec.id === id)

describe('electroBallVfx — o Electro Ball', () => {
  it('só usa texturas que existem', () => {
    for (const spec of [
      ...ELECTRO_BALL_CHARGE_EMITTERS,
      ...ELECTRO_BALL_EMITTERS,
    ]) {
      expect(ELECTRO_BALL_TEXTURE_PATHS[spec.texture]).toBeDefined()
    }
  })

  it('a bola percorre o golpe inteiro em BALL_TRAVEL', () => {
    const ball = byId('ball')
    const length = 4
    expect(ball.speed({ length }) * ball.lifetime()).toBeCloseTo(length)
    expect(ball.lifetime()).toBeCloseTo(BALL_TRAVEL)
  })

  it('o impacto e o som do alvo esperam a bola chegar', () => {
    const impact = ELECTRO_BALL_EMITTERS.filter((spec) =>
      spec.id.startsWith('impact-'),
    )
    expect(impact.length).toBeGreaterThan(0)
    for (const spec of impact) expect(spec.start).toBe(BALL_TRAVEL)
    const target = ATTACK_SOUND_COMPOSITES['electro-ball'].find(
      (part) => part.group === 'electro-ball-target',
    )
    expect(target.delay).toBeCloseTo(BALL_TRAVEL)
  })

  it('o tempo do efeito no golpe cobre tudo', () => {
    const end = Math.max(
      ...ELECTRO_BALL_EMITTERS.map(
        (spec) =>
          spec.start +
          (spec.duration ?? 0) +
          spec.lifetime({}, Array(10).fill(1)),
      ),
    )
    expect(
      getSkill('electro-ball').visual.effectVisualDuration,
    ).toBeGreaterThanOrEqual(end)
  })

  it('solta a bola no golpe e, depois, o impacto', () => {
    const system = createParticleSystem({
      emitters: ELECTRO_BALL_EMITTERS,
      textures: textures(),
      length: 3,
      radius: 0.35,
    })
    system.update(0.01)
    const early = system.group.children.filter((child) => child.visible).length
    system.update(BALL_TRAVEL)
    const later = system.group.children.filter((child) => child.visible).length
    expect(later).toBeGreaterThan(early)
    system.dispose()
  })
})
