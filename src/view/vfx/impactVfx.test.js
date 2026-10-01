import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { createParticleSystem } from './particleEmitter'
import {
  IMPACT_TYPES,
  buildImpactEmitters,
  impactTexturePaths,
  resolveImpactType,
} from './impactVfx'

function seededRandom(seed = 1) {
  let state = seed
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296
    return state / 4294967296
  }
}

function buildSystem(type, overrides = {}) {
  return createParticleSystem({
    emitters: buildImpactEmitters(type),
    textures: { hit: new THREE.Texture(), impact: new THREE.Texture() },
    length: 1,
    radius: 0.3,
    scale: 1,
    random: seededRandom(),
    ...overrides,
  })
}

function run(system, seconds, step = 1 / 60) {
  for (let t = 0; t < seconds; t += step) system.update(step)
}

const live = (system) => system.group.children.filter((s) => s.visible)

describe('resolveImpactType / impactTexturePaths', () => {
  it('tipo válido passa; vazio, null e desconhecido caem em normal', () => {
    expect(resolveImpactType('fire')).toBe('fire')
    expect(resolveImpactType('')).toBe('normal')
    expect(resolveImpactType(null)).toBe('normal')
    expect(resolveImpactType(undefined)).toBe('normal')
    expect(resolveImpactType('plasma')).toBe('normal')
  })

  it('aponta pra textura do tipo (e a do clarão é sempre a mesma)', () => {
    expect(impactTexturePaths('water')).toEqual({
      hit: '/assets/effects/impact/hit.png',
      impact: '/assets/effects/impact/impact_water.png',
    })
    expect(impactTexturePaths('???').impact).toBe(
      '/assets/effects/impact/impact_normal.png',
    )
  })

  it('cada um dos 18 tipos tem textura própria', () => {
    expect(IMPACT_TYPES).toHaveLength(18)
    expect(
      new Set(IMPACT_TYPES.map((t) => impactTexturePaths(t).impact)).size,
    ).toBe(18)
  })
})

describe('buildImpactEmitters', () => {
  it.each(IMPACT_TYPES)(
    '%s: clarão + faíscas, nascem de uma vez e terminam em ~1 s',
    (type) => {
      const emitters = buildImpactEmitters(type)
      expect(emitters.map((e) => e.id)).toEqual(['hit', 'impact'])

      const system = buildSystem(type)
      system.update(1 / 60)
      expect(system.liveCount).toBe(1 + emitters[1].burst)
      run(system, 1.2)
      expect(system.isDone()).toBe(true)
    },
  )

  it('a quantidade de faíscas segue o tipo (normal 10, lutador 12, dragão 15, inseto 20)', () => {
    const count = (type) => buildImpactEmitters(type)[1].burst
    expect(count('normal')).toBe(10)
    expect(count('fighting')).toBe(12)
    expect(count('dragon')).toBe(15)
    expect(count('bug')).toBe(20)
  })

  it('dragão e veneno têm clarão próprio, colorido e mais longo (0.5 s)', () => {
    const hitLife = (type) => buildImpactEmitters(type)[0].lifetime()
    expect(hitLife('normal')).toBeCloseTo(0.2)
    expect(hitLife('dragon')).toBeCloseTo(0.5)
    expect(hitLife('poison')).toBeCloseTo(0.5)
  })

  it('aço usa só a coluna da direita do atlas de 2 colunas', () => {
    const system = buildSystem('steel')
    system.update(1 / 60)
    const spark = live(system).find((s) => s.scale.x < 0.5)
    expect(spark.material.map.repeat.x).toBeCloseTo(0.5)
    expect(spark.material.map.offset.x).toBeCloseTo(0.5)
    expect(spark.material.map.repeat.y).toBeCloseTo(1 / 7)
  })

  it('pedra e aço jorram pra cima; o normal sai pra todo lado', () => {
    const meanY = (type) => {
      const system = buildSystem(type)
      run(system, 0.1)
      const sparks = live(system).filter((s) => s.scale.x < 0.5)
      return sparks.reduce((sum, s) => sum + s.position.y, 0) / sparks.length
    }
    expect(meanY('rock')).toBeGreaterThan(0.1)
    expect(Math.abs(meanY('normal'))).toBeLessThan(0.15)
  })

  it('a escala do golpe cresce clarão e alcance das faíscas', () => {
    const reach = (scale) => {
      const system = buildSystem('normal', { scale })
      run(system, 0.1)
      return Math.max(
        ...live(system)
          .filter((s) => s.scale.x < 1.5 * scale && s.scale.x !== scale)
          .map((s) => Math.hypot(s.position.x, s.position.y, s.position.z)),
      )
    }
    expect(reach(2)).toBeGreaterThan(reach(1) * 1.5)
  })
})
