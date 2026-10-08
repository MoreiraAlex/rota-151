import { describe, expect, it } from 'vitest'
import { GAME_CONFIG } from '../gameConfig'
import { countLayers, createHeightSampler } from './terrainHeight'

const { HILL_HEIGHT } = GAME_CONFIG.TERRAIN
const POINTS = Array.from({ length: 50 }, (_, i) => [
  i * 7.3 - 180,
  i * -5.1 + 90,
])

describe('createHeightSampler', () => {
  it('mesma seed dá a mesma altura em todo ponto', () => {
    const a = createHeightSampler(10)
    const b = createHeightSampler(10)
    for (const [x, z] of POINTS) expect(a(x, z)).toBe(b(x, z))
  })

  it('seeds diferentes dão relevos diferentes', () => {
    const a = createHeightSampler(10)
    const b = createHeightSampler(11)
    expect(POINTS.some(([x, z]) => a(x, z) !== b(x, z))).toBe(true)
  })

  it('a altura fica dentro de ± HILL_HEIGHT', () => {
    const heightAt = createHeightSampler(10)
    for (const [x, z] of POINTS) {
      const height = heightAt(x, z)
      expect(Math.abs(height)).toBeLessThanOrEqual(HILL_HEIGHT)
    }
  })

  it('é contínua: pontos muito próximos têm alturas próximas', () => {
    const heightAt = createHeightSampler(10)
    for (const [x, z] of POINTS) {
      expect(Math.abs(heightAt(x, z) - heightAt(x + 0.01, z))).toBeLessThan(
        0.05,
      )
    }
  })
})

describe('countLayers', () => {
  it('morros maiores ganham mais camadas de detalhe', () => {
    expect(countLayers(200)).toBeGreaterThan(countLayers(20))
  })

  it('sempre tem pelo menos uma camada', () => {
    expect(countLayers(2)).toBeGreaterThanOrEqual(1)
  })
})
