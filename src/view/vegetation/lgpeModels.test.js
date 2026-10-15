import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { listBiomes } from '@/core/data/biomes'
import { GAME_CONFIG } from '@/core/gameConfig'
import {
  LGPE_KIND_CATEGORIES,
  lgpeChoicesOf,
  lgpeBillboardOf,
  lgpePushOf,
  lgpeSwayOf,
} from './lgpeModels'

const GRASS_KIND = 'tall-grass'
const HEX_COLOR = /^#[0-9a-f]{6}$/i

const manifest = JSON.parse(
  readFileSync('public/assets/vegetation/lgpe/manifest.json', 'utf8'),
)

describe("modelos do Let's Go nos biomas", () => {
  it('todo tipo dos biomas que aparecem no mundo tem modelos (sem eles não nasce)', () => {
    const visible = listBiomes().filter(
      ({ id }) => !GAME_CONFIG.BIOMES.HIDDEN.includes(id),
    )
    for (const { vegetation } of visible) {
      for (const { models } of vegetation) {
        expect(models?.length).toBeGreaterThan(0)
      }
    }
  })

  it('todo modelo dos biomas existe no manifesto', () => {
    for (const { vegetation } of listBiomes()) {
      for (const { models = [] } of vegetation) {
        for (const id of models) expect(manifest.props[id]).toBeDefined()
      }
    }
  })

  it('todo modelo dos biomas é de uma categoria que o tipo aceita', () => {
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

  it('toda planta abre para quem passa; árvore e pedra não', () => {
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

  it('o que fica de frente para a câmera existe e balança como planta', () => {
    const billboards = Object.keys(manifest.props).filter(lgpeBillboardOf)
    expect(billboards.length).toBeGreaterThan(0)
    for (const id of billboards) {
      expect(lgpeSwayOf(manifest.props[id].category)).toBe('plant')
    }
  })

  it('a grama de todo bioma tem modelos e as duas cores', () => {
    for (const { vegetation } of listBiomes()) {
      const grass = vegetation.find(({ kind }) => kind === GRASS_KIND)
      if (!grass) continue
      expect(grass.models?.length).toBeGreaterThan(0)
      expect(Object.keys(grass.colors).sort()).toEqual(['a', 'b'])
    }
  })

  it('toda tinta (`tint`) dos biomas é uma cor e uma força de 0 a 1', () => {
    for (const { vegetation } of listBiomes()) {
      for (const { tint } of vegetation) {
        if (tint === undefined) continue
        expect(tint.color).toMatch(HEX_COLOR)
        expect(tint.amount).toBeGreaterThanOrEqual(0)
        expect(tint.amount).toBeLessThanOrEqual(1)
      }
    }
  })
})

// docs/features/056-bioma-cidade.md
describe('cidades', () => {
  const towns = listBiomes()
    .map(({ town }) => town)
    .filter(Boolean)

  it('os materiais pintados do ginásio existem no modelo dele', () => {
    for (const town of towns) {
      for (const { model, paint } of town.landmarks) {
        if (!paint) continue
        const materials = Object.keys(manifest.props[model].materials)
        for (const name of paint.materials) expect(materials).toContain(name)
      }
    }
  })

  it('todo tema tem cor de ginásio válida e modelos que existem', () => {
    for (const town of towns) {
      for (const theme of town.themes) {
        expect(theme.gymColor).toMatch(HEX_COLOR)
        const models = [theme.special, ...theme.houses]
          .filter(Boolean)
          .map(({ model }) => model)
        for (const id of models) expect(manifest.props[id]).toBeDefined()
      }
    }
  })
})
