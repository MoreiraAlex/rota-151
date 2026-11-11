import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { GAME_CONFIG } from '@/core/gameConfig'
import {
  BLADE_GRASS_ID,
  bladeGrassProp,
  createBladeTuftGeometry,
  isProceduralProp,
  withProceduralProps,
} from './bladeGrass'
import { lgpeChoicesOf, missingPropFields } from './lgpeModels'

const manifest = JSON.parse(
  readFileSync('public/assets/vegetation/lgpe/manifest.json', 'utf8'),
)
const params = GAME_CONFIG.GRASS_BLADES

describe('grama em fios (066)', () => {
  const geometry = createBladeTuftGeometry(params)
  const position = geometry.getAttribute('position')

  it('o tufo tem as lâminas pedidas, cada uma com os vértices das partes', () => {
    const perBlade = (params.SEGMENTS + 1) * 2
    expect(position.count).toBe(params.COUNT * perBlade)
    expect(geometry.index.count).toBe(params.COUNT * params.SEGMENTS * 6)
  })

  it('a base fica no chão e nenhuma lâmina passa da altura máxima', () => {
    const ys = Array.from({ length: position.count }, (_, i) =>
      position.getY(i),
    )
    expect(Math.min(...ys)).toBeCloseTo(0, 6)
    expect(Math.max(...ys)).toBeLessThanOrEqual(
      params.HEIGHT * (1 + params.HEIGHT_VARIATION) + 1e-6,
    )
  })

  it('as normais apontam para cima (a luz não depende da câmera)', () => {
    const normal = geometry.getAttribute('normal')
    for (let i = 0; i < normal.count; i++) {
      expect([normal.getX(i), normal.getY(i), normal.getZ(i)]).toEqual([
        0, 1, 0,
      ])
    }
  })

  // O meio e o eixo da largura de cada parte de uma lâmina.
  const perBlade = (params.SEGMENTS + 1) * 2
  const rowOf = (blade, step) => {
    const a = blade * perBlade + step * 2
    const [ax, az] = [position.getX(a), position.getZ(a)]
    const [bx, bz] = [position.getX(a + 1), position.getZ(a + 1)]
    return {
      middle: [(ax + bx) / 2, (az + bz) / 2],
      across: Math.atan2(bz - az, bx - ax),
    }
  }

  it('as lâminas nascem retas (a curva é só do vento)', () => {
    for (let blade = 0; blade < params.COUNT; blade++) {
      const root = rowOf(blade, 0).middle
      for (let step = 1; step <= params.SEGMENTS; step++) {
        const { middle } = rowOf(blade, step)
        expect(middle[0]).toBeCloseTo(root[0], 6)
        expect(middle[1]).toBeCloseTo(root[1], 6)
      }
    }
  })

  it('cada lâmina vira para um lado (o tufo aparece de qualquer ângulo)', () => {
    const sides = new Set()
    for (let blade = 0; blade < params.COUNT; blade++) {
      // Lado da lâmina sem o sentido (a tira é igual girada meia volta).
      const across = rowOf(blade, 0).across
      sides.add(Math.round((((across % Math.PI) + Math.PI) % Math.PI) * 4))
    }
    expect(sides.size).toBeGreaterThan(1)
  })

  it('a raiz é mais escura que a ponta', () => {
    const color = geometry.getAttribute('color')
    const perBlade = (params.SEGMENTS + 1) * 2
    for (let blade = 0; blade < params.COUNT; blade++) {
      const root = color.getX(blade * perBlade)
      const tip = color.getX(blade * perBlade + perBlade - 1)
      expect(tip).toBeGreaterThan(root)
    }
  })

  it('o mesmo sorteio dá o mesmo tufo', () => {
    const again = createBladeTuftGeometry(params).getAttribute('position')
    expect(Array.from(again.array)).toEqual(Array.from(position.array))
  })

  it('entra no manifesto como grama, completa e sem arquivo', () => {
    const merged = withProceduralProps(manifest)
    expect(isProceduralProp(merged, BLADE_GRASS_ID)).toBe(true)
    expect(isProceduralProp(merged, Object.keys(manifest.props)[0])).toBe(false)
    expect(missingPropFields(bladeGrassProp())).toEqual([])
    expect(lgpeChoicesOf(merged, 'tall-grass')).toHaveProperty(BLADE_GRASS_ID)
    expect(withProceduralProps(merged)).toBe(merged)
  })
})
