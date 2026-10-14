import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { listBiomes } from '@/core/data/biomes'
import { GAME_CONFIG } from '@/core/gameConfig'
import { STANDING_TREE_KINDS } from '@/core/vegetation/solidPlacement'
import { GRASS_MODEL_CHOICES } from './lgpeModels'
import { PART_COLORS, PART_KINDS, VEGETATION_MODELS } from './vegetationAssets'

const GRASS_KIND = 'tall-grass'

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
      for (const { kind, models } of vegetation) {
        if (models?.length) continue
        expect(VEGETATION_MODELS[kind]?.length).toBeGreaterThan(0)
      }
    }
  })

  it("todo modelo do Let's Go dos biomas existe no manifesto", () => {
    const manifest = JSON.parse(
      readFileSync('public/assets/vegetation/lgpe/manifest.json', 'utf8'),
    )
    for (const { vegetation } of listBiomes()) {
      for (const { models = [] } of vegetation) {
        for (const id of models) expect(manifest.props[id]).toBeDefined()
      }
    }
    // As opções de grama do painel também.
    for (const id of Object.keys(GRASS_MODEL_CHOICES)) {
      expect(manifest.props[id]).toBeDefined()
    }
  })

  it("a grama de todo bioma tem modelos do Let's Go e as duas cores (não tem padrão)", () => {
    for (const { vegetation } of listBiomes()) {
      const grass = vegetation.find(({ kind }) => kind === GRASS_KIND)
      if (!grass) continue
      expect(VEGETATION_MODELS[GRASS_KIND]).toBeUndefined()
      expect(grass.models?.length).toBeGreaterThan(0)
      expect(Object.keys(grass.colors).sort()).toEqual(['a', 'b'])
    }
  })

  it('toda parte com cor tem um jeito de desenhar e lê uma cor do config', () => {
    for (const [material, colorFrom] of Object.entries(PART_COLORS)) {
      expect(PART_KINDS[material]).toBeDefined()
      expect(typeof colorFrom(GAME_CONFIG)).toBe('string')
    }
  })
})
