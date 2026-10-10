import { describe, expect, it } from 'vitest'
import { listBiomes } from '@/core/data/biomes'
import { GAME_CONFIG } from '@/core/gameConfig'
import { LOG_KIND, STANDING_TREE_KINDS } from '@/core/vegetation/solidPlacement'
import { PART_COLORS, PART_KINDS, VEGETATION_MODELS } from './vegetationAssets'

// Desenhados sem modelo do MegaKit: a grama (stylized-scene) e o tronco
// caído (feito em código).
const DRAWN_ELSEWHERE = ['tall-grass', LOG_KIND]

describe('vegetationAssets', () => {
  it('toda espécie de árvore em pé tem modelo', () => {
    for (const kind of STANDING_TREE_KINDS) {
      expect(VEGETATION_MODELS[kind]?.length).toBeGreaterThan(0)
    }
  })

  it('todo tipo dos biomas que aparecem no mundo é desenhado', () => {
    const visible = listBiomes().filter(
      ({ id }) => !GAME_CONFIG.BIOMES.HIDDEN.includes(id),
    )
    for (const { vegetation } of visible) {
      for (const { kind } of vegetation) {
        if (DRAWN_ELSEWHERE.includes(kind)) continue
        expect(VEGETATION_MODELS[kind]?.length).toBeGreaterThan(0)
      }
    }
  })

  it('toda parte com cor tem um jeito de desenhar e lê uma cor do config', () => {
    for (const [material, colorFrom] of Object.entries(PART_COLORS)) {
      expect(PART_KINDS[material]).toBeDefined()
      expect(typeof colorFrom(GAME_CONFIG)).toBe('string')
    }
  })
})
