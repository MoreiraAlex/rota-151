import { describe, expect, it } from 'vitest'
import { TEST_LEVEL } from '@/core/data/testLevel'
import { GAME_CONFIG } from '@/core/gameConfig'
import { LAB_BIOMES, findBiomePoints } from './labPoints'

// Um mundo de mentira: faixas de bioma por x, tudo acima da água.
const stripes = (ids, width) => ({
  biomeAt: (x) => ({
    id: ids[Math.abs(Math.floor(x / width)) % ids.length],
  }),
  heightAt: () => 5,
})

describe('pontos do laboratório de biomas (066)', () => {
  it('na seed atual, cada bioma do lab cai mesmo no bioma pedido', () => {
    const terrain = TEST_LEVEL.terrain
    const points = findBiomePoints(terrain, LAB_BIOMES)
    for (const id of LAB_BIOMES) {
      if (GAME_CONFIG.BIOMES.HIDDEN.includes(id)) continue
      const point = points[id]
      expect(point, id).not.toBeNull()
      expect(terrain.biomeAt(point.x, point.z).id).toBe(id)
      expect(terrain.heightAt(point.x, point.z)).toBeGreaterThan(0)
    }
  })

  it('o ponto tem o bioma em volta, não só no centro', () => {
    const terrain = stripes(['a', 'b'], 200)
    const margin = 25
    const { a, b } = findBiomePoints(terrain, ['a', 'b'], { margin })
    for (const [id, point] of Object.entries({ a, b })) {
      for (const dx of [-margin, 0, margin]) {
        expect(terrain.biomeAt(point.x + dx, point.z).id).toBe(id)
      }
    }
  })

  it('bioma que não existe fica sem ponto', () => {
    const points = findBiomePoints(stripes(['a'], 100), ['a', 'nenhum'], {
      maxRadius: 200,
    })
    expect(points.a).not.toBeNull()
    expect(points.nenhum).toBeNull()
  })

  it('não escolhe ponto debaixo da água', () => {
    const terrain = { ...stripes(['a'], 100), heightAt: () => -1 }
    expect(findBiomePoints(terrain, ['a'], { maxRadius: 200 }).a).toBeNull()
  })
})
