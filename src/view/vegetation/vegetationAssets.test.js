import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { listBiomes } from '@/core/data/biomes'
import { GAME_CONFIG } from '@/core/gameConfig'
import { STANDING_TREE_KINDS } from '@/core/vegetation/solidPlacement'
import {
  LGPE_KIND_CATEGORIES,
  lgpeChoicesOf,
  lgpePushOf,
  lgpeSwayOf,
} from './lgpeModels'
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

  const manifest = JSON.parse(
    readFileSync('public/assets/vegetation/lgpe/manifest.json', 'utf8'),
  )

  it("todo modelo do Let's Go dos biomas existe no manifesto", () => {
    for (const { vegetation } of listBiomes()) {
      for (const { models = [] } of vegetation) {
        for (const id of models) expect(manifest.props[id]).toBeDefined()
      }
    }
  })

  it("todo modelo do Let's Go dos biomas é de uma categoria que o tipo aceita", () => {
    for (const { vegetation } of listBiomes()) {
      for (const { kind, models = [] } of vegetation) {
        for (const id of models) {
          expect(LGPE_KIND_CATEGORIES[kind]).toContain(
            manifest.props[id].category,
          )
        }
      }
    }
  })

  it('as opções do painel de um tipo são só props das categorias dele', () => {
    for (const [kind, categories] of Object.entries(LGPE_KIND_CATEGORIES)) {
      const ids = Object.keys(lgpeChoicesOf(manifest, kind))
      expect(ids.length).toBeGreaterThan(0)
      for (const id of ids) {
        expect(categories).toContain(manifest.props[id].category)
      }
    }
  })

  it("bioma com o chão do Let's Go não usa modelo padrão (MegaKit) em nenhum tipo", () => {
    for (const { ground, vegetation } of listBiomes()) {
      if (!ground.colors) continue
      for (const { models } of vegetation) {
        expect(models?.length).toBeGreaterThan(0)
      }
    }
  })

  it("toda planta do Let's Go abre para quem passa; árvore e pedra não", () => {
    const categories = new Set(
      Object.values(manifest.props).map(({ category }) => category),
    )
    for (const category of categories) {
      const isPlant = lgpeSwayOf(category) === 'plant'
      expect(Boolean(lgpePushOf(category))).toBe(isPlant)
    }
    expect(lgpePushOf('tree')).toBe(false)
    expect(lgpePushOf('rock')).toBe(false)
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
