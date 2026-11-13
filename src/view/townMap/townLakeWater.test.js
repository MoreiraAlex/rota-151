import { describe, expect, it } from 'vitest'
import { buildTownLakeWaterGeometry } from './townLakeWater'

// A água do lago da cidade montada à mão (docs/features/069-revisao-do-
// bioma-cidade.md): uma grade na superfície, com a profundidade do chão.
describe('buildTownLakeWaterGeometry', () => {
  const lake = { rect: [0, 0, 4, 3], surface: 10 }
  // Uma bacia: fundo dentro do retângulo, chão acima da água fora.
  const heightAt = (x, z) => (x > 0.5 && x < 3.5 && z > 0.5 && z < 2.5 ? 8 : 11)

  it('sem lago, nada', () => {
    expect(buildTownLakeWaterGeometry(null, heightAt, 0.3)).toBeNull()
  })

  it('a superfície é plana e a profundidade é a superfície menos o chão', () => {
    const geometry = buildTownLakeWaterGeometry(lake, heightAt, 0.3)
    const positions = geometry.getAttribute('position')
    const depths = geometry.getAttribute('waterDepth')
    for (let i = 0; i < positions.count; i++) {
      expect(positions.getY(i)).toBe(lake.surface)
      const x = positions.getX(i)
      const z = positions.getZ(i)
      expect(depths.getX(i)).toBeCloseTo(lake.surface - heightAt(x, z), 6)
    }
    geometry.dispose()
  })

  it('a grade cobre o lago e pula o que é todo terra seca', () => {
    const geometry = buildTownLakeWaterGeometry(lake, heightAt, 0.3)
    const depths = geometry.getAttribute('waterDepth')
    const index = geometry.getIndex()
    for (let i = 0; i < index.count; i += 6) {
      const quad = [0, 1, 2, 5].map((k) => depths.getX(index.getX(i + k)))
      expect(quad.some((depth) => depth > -0.3)).toBe(true)
    }
    expect(index.count).toBeGreaterThan(0)
    geometry.dispose()
  })
})
