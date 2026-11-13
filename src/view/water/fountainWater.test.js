import { describe, expect, it } from 'vitest'
import { listBiomes } from '@/core/data/biomes'
import { fountainWaterOf } from '@/core/town/fountains'
import { buildFountainWaterGeometry } from './fountainWater'

const CITY = listBiomes().find(({ town }) => town?.plaza?.water)
const town = CITY?.town

// A água de uma fonte posta como a planta da cidade põe.
const waterAt = (x, z, scale = 1) =>
  fountainWaterOf({
    kind: 'street-prop',
    model: town.props.fountain,
    biome: CITY.id,
    x,
    y: 2,
    z,
    yaw: 0,
    scale,
  })

describe.runIf(CITY)('buildFountainWaterGeometry', () => {
  it('sem fonte: sem superfície', () => {
    expect(buildFountainWaterGeometry([])).toBeNull()
  })

  it('um disco na superfície da água, dentro do raio, virado para cima', () => {
    const fountain = waterAt(10, -4, 1.5)
    const geometry = buildFountainWaterGeometry([fountain])
    const position = geometry.getAttribute('position')
    const normal = geometry.getAttribute('normal')
    for (let i = 0; i < position.count; i++) {
      expect(position.getY(i)).toBeCloseTo(fountain.surface)
      const reach = Math.hypot(
        position.getX(i) - fountain.x,
        position.getZ(i) - fountain.z,
      )
      expect(reach).toBeLessThanOrEqual(fountain.radius + 1e-6)
      expect(normal.getY(i)).toBeGreaterThan(0)
    }
  })

  it('a cor lê mais fundo no meio que na beira; sem correnteza', () => {
    const fountain = waterAt(0, 0)
    const geometry = buildFountainWaterGeometry([fountain])
    const depth = geometry.getAttribute('waterDepth')
    const flow = geometry.getAttribute('waterFlow')
    expect(depth.getX(0)).toBeCloseTo(fountain.water.colorDepth)
    for (let i = 1; i < depth.count; i++) {
      expect(depth.getX(i)).toBeCloseTo(fountain.water.edgeDepth)
      expect(depth.getX(i)).toBeLessThan(depth.getX(0))
    }
    expect([...flow.array].every((value) => value === 0)).toBe(true)
  })
})
