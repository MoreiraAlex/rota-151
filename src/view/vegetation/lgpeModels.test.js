import { readFileSync } from 'node:fs'
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { listBiomes } from '@/core/data/biomes'
import { GAME_CONFIG } from '@/core/gameConfig'
import {
  LGPE_KIND_CATEGORIES,
  lgpeChoicesOf,
  lgpeBillboardOf,
  lgpePushOf,
  lgpeSwayOf,
  mergeLgpeManifests,
  missingPropFields,
  prepareLgpeTexture,
  withBorrowedLeaves,
  withHeightRamp,
} from './lgpeModels'
import { withProceduralProps } from './bladeGrass'

const GRASS_KIND = 'tall-grass'
const HEX_COLOR = /^#[0-9a-f]{6}$/i

const manifest = JSON.parse(
  readFileSync('public/assets/vegetation/lgpe/manifest.json', 'utf8'),
)
// O que o jogo vê: o LGPE, os pacotes do jogo (docs/features/066-revisao-
// dos-biomas.md) e os modelos gerados por código (a grama em fios).
const PACKS_DIR = 'public/assets/vegetation/packs'
const gamePacks = JSON.parse(
  readFileSync(`${PACKS_DIR}/packs.json`, 'utf8'),
).map((id) => ({
  manifest: JSON.parse(
    readFileSync(`${PACKS_DIR}/${id}/manifest.json`, 'utf8'),
  ),
  dir: `/assets/vegetation/packs/${id}`,
}))
const gameManifest = withProceduralProps(
  mergeLgpeManifests(manifest, gamePacks),
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
        for (const id of models) expect(gameManifest.props[id]).toBeDefined()
      }
    }
  })

  it('todo modelo dos pacotes do jogo tem o que a vegetação lê', () => {
    for (const { manifest: pack } of gamePacks) {
      for (const prop of Object.values(pack.props)) {
        expect(missingPropFields(prop)).toEqual([])
      }
    }
  })

  it('todo modelo dos biomas é de uma categoria que o tipo aceita', () => {
    for (const { vegetation } of listBiomes()) {
      for (const { kind, models = [] } of vegetation) {
        for (const id of models) {
          expect(LGPE_KIND_CATEGORIES[kind]).toContain(
            gameManifest.props[id].category,
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

describe('pacotes de fora (laboratório de biomas, 066)', () => {
  it('textura do LGPE vira (UV de baixo para cima); a do pacote glTF não', () => {
    expect(prepareLgpeTexture({}).flipY).toBe(true)
    expect(prepareLgpeTexture({}, { flipY: false }).flipY).toBe(false)
  })

  const someId = Object.keys(manifest.props)[0]
  const pack = {
    dir: '/assets/lab/teste',
    manifest: {
      props: { 'arvore-de-fora': { ...manifest.props[someId] } },
      textures: { 'textura-de-fora': {} },
    },
  }

  it('todo prop do LGPE tem o que a vegetação lê (a régua dos pacotes)', () => {
    for (const prop of Object.values(manifest.props)) {
      expect(missingPropFields(prop)).toEqual([])
    }
  })

  it('aponta o que falta num prop incompleto', () => {
    const { materials, ...withoutMaterials } = manifest.props[someId]
    expect(materials).toBeDefined()
    expect(missingPropFields(withoutMaterials)).toContain('materials')
    expect(
      missingPropFields({ ...manifest.props[someId], size: [1, 0] }),
    ).toContain('size')
  })

  it('sem pacote, o manifesto do LGPE fica como está', () => {
    expect(mergeLgpeManifests(manifest, [])).toBe(manifest)
  })

  it('junta os props e as texturas do pacote, cada um com a pasta dele', () => {
    const merged = mergeLgpeManifests(manifest, [pack])
    expect(merged.props['arvore-de-fora'].dir).toBe(pack.dir)
    expect(merged.textures['textura-de-fora'].dir).toBe(pack.dir)
    expect(merged.props[someId]).toEqual(manifest.props[someId])
    expect(Object.keys(merged.props)).toHaveLength(
      Object.keys(manifest.props).length + 1,
    )
  })

  it('o prop do pacote aparece nas escolhas do tipo da categoria dele', () => {
    const merged = mergeLgpeManifests(manifest, [pack])
    const { category } = merged.props['arvore-de-fora']
    const kind = Object.keys(LGPE_KIND_CATEGORIES).find((k) =>
      LGPE_KIND_CATEGORIES[k].includes(category),
    )
    expect(lgpeChoicesOf(merged, kind)).toHaveProperty('arvore-de-fora')
  })
})

describe('folhas do LGPE nas árvores dos pacotes (066)', () => {
  const merged = mergeLgpeManifests(manifest, gamePacks)
  const sourceId = GAME_CONFIG.LGPE.PACK_LEAVES
  const leafOf = (prop) =>
    Object.values(prop.materials).find(
      ({ cutoff, doubleSided }) => cutoff != null && doubleSided,
    )
  const packTrees = Object.entries(merged.props).filter(
    ([, prop]) => prop.dir && prop.category === 'tree',
  )

  it('a árvore de onde vêm as folhas existe e tem folha', () => {
    expect(leafOf(manifest.props[sourceId])).toBeDefined()
  })

  it('as folhas das árvores dos pacotes viram as do LGPE; o tronco fica', () => {
    const borrowed = withBorrowedLeaves(merged, sourceId)
    const leaf = leafOf(manifest.props[sourceId])
    expect(packTrees.length).toBeGreaterThan(0)
    for (const [id, prop] of packTrees) {
      for (const [name, material] of Object.entries(
        borrowed.props[id].materials,
      )) {
        if (/leaves/i.test(name)) {
          expect(material).toEqual({ ...leaf, rampFromHeight: true })
        } else {
          expect(material).toBe(prop.materials[name])
        }
      }
    }
  })

  it('os modelos do LGPE não mudam; sem árvore de origem, nada muda', () => {
    const borrowed = withBorrowedLeaves(merged, sourceId)
    for (const id of Object.keys(manifest.props)) {
      expect(borrowed.props[id]).toBe(merged.props[id])
    }
    expect(withBorrowedLeaves(merged, null)).toBe(merged)
  })

  it('o segundo UV da rampa sobe com a altura, dentro da textura', () => {
    const geometry = new THREE.BufferGeometry()
    const heights = [3, 5, 4, 8, 6]
    geometry.setAttribute(
      'position',
      new THREE.BufferAttribute(
        Float32Array.from(heights.flatMap((y) => [0, y, 0])),
        3,
      ),
    )
    const ramped = withHeightRamp(geometry)
    expect(geometry.getAttribute('uv1')).toBeUndefined()
    const uv1 = ramped.getAttribute('uv1')
    const order = heights
      .map((y, i) => [y, uv1.getY(i)])
      .sort((a, b) => a[0] - b[0])
    for (let i = 1; i < order.length; i++) {
      expect(order[i][1]).toBeGreaterThan(order[i - 1][1])
    }
    for (const [, v] of order) {
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThanOrEqual(1)
    }
  })
})
