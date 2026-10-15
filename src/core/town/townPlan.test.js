import { describe, expect, it } from 'vitest'
import { getBiome, listBiomes } from '../data/biomes'
import { GAME_CONFIG } from '../gameConfig'
import { generateTerrainChunk } from '../terrain/terrainChunk'
import {
  copyTerrainRecipe,
  createTerrainSampler,
  currentTerrainRecipe,
} from '../terrain/terrainHeight'
import { placeChunkSolids } from '../vegetation/solidPlacement'
import {
  BUILDING_KIND,
  chunkStreets,
  modelBoxOf,
  placeTown,
  rectFootprints,
  streetStrengthAt,
  withStreets,
} from './townPlan'

const CITY = listBiomes().find(({ town }) => town)
// O prédio especial e as casas de um tema.
const themeBuildings = ({ special, houses }) =>
  [special, ...houses].filter(Boolean)
const NOT_CITY = listBiomes().find(({ town }) => !town)
const SEED = 7

// Mundo só com o bioma `biome` (o peso dele é 1 em todo lugar).
const worldOf = (biome) =>
  copyTerrainRecipe({ ...currentTerrainRecipe(), biomeList: [biome] })

// Um bloco de sólidos (o chunk em que `placeTown` roda no jogo).
function blockOf(recipe, blockX, blockZ, seed = SEED) {
  const sampler = createTerrainSampler(seed, recipe)
  return generateTerrainChunk(sampler, blockX, blockZ, {
    ...recipe.terrain,
    CHUNK_SIZE: recipe.terrain.SOLIDS_BLOCK_SIZE,
  })
}

const townOf = (recipe, chunk, seed = SEED) =>
  placeTown(chunk, {
    seed,
    biomeList: recipe.biomeList,
    terrain: recipe.terrain,
  })

// A caixa de um sólido da cidade no chão do mundo (giro em múltiplos de 90°).
function worldRectOf(solid) {
  const [minX, minZ, maxX, maxZ] = modelBoxOf(solid.model).map(
    (value) => value * solid.scale,
  )
  const cos = Math.round(Math.cos(solid.yaw))
  const sin = Math.round(Math.sin(solid.yaw))
  const corners = [
    [minX, minZ],
    [minX, maxZ],
    [maxX, minZ],
    [maxX, maxZ],
  ].map(([x, z]) => [solid.x + x * cos + z * sin, solid.z - x * sin + z * cos])
  const xs = corners.map(([x]) => x)
  const zs = corners.map(([, z]) => z)
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minZ: Math.min(...zs),
    maxZ: Math.max(...zs),
    corners,
  }
}

const rectsOverlap = (a, b) =>
  a.minX < b.maxX && b.minX < a.maxX && a.minZ < b.maxZ && b.minZ < a.maxZ

// Blocos longe da origem (onde o treinador nasce e nada é posto).
const BLOCKS = [
  [3, 2],
  [-4, 1],
  [2, -5],
]

describe.runIf(CITY)('a cidade nos dados', () => {
  it('não tem itens no chão nem fruta', () => {
    expect(CITY.worldItems).toBeUndefined()
    expect(CITY.forage).toBeUndefined()
  })

  it('o quarteirão divide o bloco de sólidos (nenhum fica em dois)', () => {
    // Os blocos são centrados na origem (de -metade a +metade): o
    // quarteirão divide a metade, e as divisas batem.
    const { SOLIDS_BLOCK_SIZE } = GAME_CONFIG.TERRAIN
    expect((SOLIDS_BLOCK_SIZE / 2) % CITY.town.blockSize).toBe(0)
  })

  it('todo modelo da cidade tem caixa no chão', () => {
    const { landmarks, themes, props } = CITY.town
    const models = [
      ...[...landmarks, ...themes.flatMap(themeBuildings)].map(
        ({ model }) => model,
      ),
      ...themes.flatMap(({ lamp, fence }) => [lamp, fence]).filter(Boolean),
      props.lamp,
      props.fence,
      props.bench,
    ]
    for (const model of models) expect(() => modelBoxOf(model)).not.toThrow()
  })

  it('é o último do registro (os índices dos outros não mudam)', () => {
    expect(listBiomes().at(-1)).toBe(getBiome(CITY.id))
  })
})

describe.runIf(CITY)('streetStrengthAt', () => {
  const { town } = CITY

  it('rua cheia na linha da grade e nenhuma no meio do quarteirão', () => {
    const { blockSize } = town
    expect(streetStrengthAt(town, blockSize * 3, blockSize * 0.5)).toBe(1)
    expect(streetStrengthAt(town, blockSize * 0.5, -blockSize * 2)).toBe(1)
    expect(streetStrengthAt(town, blockSize * 2.5, blockSize * 1.5)).toBe(0)
  })

  it('a força fica entre 0 e 1', () => {
    for (let x = 0; x < town.blockSize; x += 0.7) {
      const value = streetStrengthAt(town, x, town.blockSize / 2)
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThanOrEqual(1)
    }
  })
})

describe.runIf(CITY && NOT_CITY)('chunkStreets e withStreets', () => {
  it('fora da cidade não há rua', () => {
    const recipe = worldOf(NOT_CITY)
    const chunk = blockOf(recipe, 1, 1)
    expect(chunkStreets(chunk, { biomeList: recipe.biomeList })).toBeNull()
  })

  it('na cidade há rua, entre 0 e 1', () => {
    const recipe = worldOf(CITY)
    const chunk = blockOf(recipe, 1, 1)
    const streets = chunkStreets(chunk, { biomeList: recipe.biomeList })
    expect(streets.some((value) => value === 1)).toBe(true)
    for (const value of streets) {
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThanOrEqual(1)
    }
  })

  it('junta trilha e rua pela mais forte de cada vértice', () => {
    const trails = Float32Array.from([0, 0.5, 1, 0.2])
    const streets = Float32Array.from([0.3, 0.1, 0, 0.9])
    expect([...withStreets(trails, streets)]).toEqual(
      [...trails].map((value, i) => Math.max(value, streets[i])),
    )
    expect(withStreets(null, streets)).toBe(streets)
    expect(withStreets(trails, null)).toBe(trails)
  })
})

describe('rectFootprints', () => {
  const box = [-2, -1, 3, 1.5]
  const cell = GAME_CONFIG.TOWN.FOOTPRINT_CELL
  const covers = (circles, [x, z]) =>
    circles.some((c) => Math.hypot(c.x - x, c.z - z) <= c.radius + 1e-6)

  it('cobre a caixa inteira, girada e no tamanho', () => {
    for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
      const solid = { x: 10, z: -4, yaw, scale: 1.5, model: null }
      const circles = rectFootprints(box, solid, cell)
      const cos = Math.round(Math.cos(yaw))
      const sin = Math.round(Math.sin(yaw))
      for (let u = 0; u <= 1; u += 0.25) {
        for (let v = 0; v <= 1; v += 0.25) {
          const x = (box[0] + u * (box[2] - box[0])) * solid.scale
          const z = (box[1] + v * (box[3] - box[1])) * solid.scale
          const point = [
            solid.x + x * cos + z * sin,
            solid.z - x * sin + z * cos,
          ]
          expect(covers(circles, point)).toBe(true)
        }
      }
    }
  })

  it('cada círculo não passa de uma célula', () => {
    const circles = rectFootprints(box, { x: 0, z: 0, yaw: 0, scale: 1 }, cell)
    for (const circle of circles) {
      expect(circle.radius).toBeLessThanOrEqual((cell * Math.SQRT2) / 2 + 1e-6)
    }
  })
})

describe.runIf(CITY)('placeTown', () => {
  const recipe = worldOf(CITY)
  const { town } = CITY
  const blocks = BLOCKS.map(([x, z]) => blockOf(recipe, x, z))
  const towns = blocks.map((chunk) => townOf(recipe, chunk))

  it('põe prédios na cidade', () => {
    const buildings = towns.flatMap(({ buildings }) =>
      buildings.filter(({ kind }) => kind === BUILDING_KIND),
    )
    expect(buildings.length).toBeGreaterThan(0)
  })

  it('mesma seed, mesma cidade; seed diferente, outra', () => {
    blocks.forEach((chunk, i) => {
      expect(townOf(recipe, chunk)).toEqual(towns[i])
    })
    const other = blocks.map((chunk) => townOf(recipe, chunk, SEED + 1))
    expect(other).not.toEqual(towns)
  })

  it('fora da cidade não põe nada', () => {
    const plain = worldOf(NOT_CITY)
    expect(townOf(plain, blockOf(plain, 3, 2))).toEqual({
      buildings: [],
      footprints: [],
    })
  })

  it('nenhum prédio sobrepõe outro nem cai na rua', () => {
    for (const { buildings } of towns) {
      const rects = buildings
        .filter(({ kind }) => kind === BUILDING_KIND)
        .map(worldRectOf)
      rects.forEach((rect, i) => {
        for (const other of rects.slice(i + 1)) {
          expect(rectsOverlap(rect, other)).toBe(false)
        }
        for (const [x, z] of rect.corners) {
          expect(streetStrengthAt(town, x, z)).toBe(0)
        }
      })
    }
  })

  it('cada prédio fica de frente para uma rua', () => {
    for (const { buildings } of towns) {
      for (const building of buildings) {
        if (building.kind !== BUILDING_KIND) continue
        const front = modelBoxOf(building.model)[3] * building.scale
        const ahead = front + town.setback + town.streetWidth / 2
        const x = building.x + Math.sin(building.yaw) * ahead
        const z = building.z + Math.cos(building.yaw) * ahead
        expect(streetStrengthAt(town, x, z)).toBeGreaterThan(0)
      }
    }
  })

  it('todo prédio sabe o tema da cidade dele', () => {
    const ids = town.themes.map(({ id }) => id)
    for (const { buildings } of towns) {
      for (const { kind, theme } of buildings) {
        if (kind === BUILDING_KIND) expect(ids).toContain(theme)
      }
    }
  })

  it('os prédios únicos e as casas são os da cidade', () => {
    const models = [
      ...town.landmarks,
      ...town.themes.flatMap(themeBuildings),
    ].map(({ model }) => model)
    for (const { buildings } of towns) {
      for (const { kind, model } of buildings) {
        if (kind === BUILDING_KIND) expect(models).toContain(model)
      }
    }
  })

  it('a pegada de tudo fica dentro do chunk (navegação por chunk)', () => {
    blocks.forEach((chunk, i) => {
      for (const { x, z, radius } of towns[i].footprints) {
        expect(x - radius).toBeGreaterThanOrEqual(chunk.minX)
        expect(x + radius).toBeLessThanOrEqual(chunk.minX + chunk.size)
        expect(z - radius).toBeGreaterThanOrEqual(chunk.minZ)
        expect(z + radius).toBeLessThanOrEqual(chunk.minZ + chunk.size)
      }
    })
  })

  it('nada perto da origem (onde o treinador nasce)', () => {
    const chunk = blockOf(recipe, 0, 0)
    for (const { x, z, radius } of townOf(recipe, chunk).footprints) {
      expect(Math.hypot(x, z) + 1e-6).toBeGreaterThanOrEqual(
        GAME_CONFIG.TOWN.SPAWN_CLEAR_RADIUS + radius,
      )
    }
  })

  it('a base do prédio fica no chão ou abaixo dele (sem vão)', () => {
    blocks.forEach((chunk, i) => {
      for (const building of towns[i].buildings) {
        const rect = worldRectOf(building)
        for (const [x, z] of rect.corners) {
          const sampler = createTerrainSampler(SEED, recipe)
          expect(building.y).toBeLessThanOrEqual(sampler.heightAt(x, z) + 0.05)
        }
      }
    })
  })
})

describe.runIf(CITY)('a cidade nos sólidos', () => {
  const recipe = worldOf(CITY)
  const [blockX, blockZ] = BLOCKS[0]
  const chunk = blockOf(recipe, blockX, blockZ)
  chunk.trails = withStreets(
    null,
    chunkStreets(chunk, { biomeList: recipe.biomeList }),
  )
  const solids = placeChunkSolids(chunk, {
    seed: SEED,
    biomeList: recipe.biomeList,
    terrain: recipe.terrain,
    params: recipe.solids,
  })

  it('os prédios entram nos sólidos, com as pegadas deles', () => {
    const town = townOf(recipe, chunk)
    expect(solids.buildings).toEqual(town.buildings)
    for (const circle of town.footprints) {
      expect(solids.footprints).toContainEqual(circle)
    }
  })

  it('nenhuma árvore nasce dentro de prédio', () => {
    const rects = solids.buildings
      .filter(({ kind }) => kind === BUILDING_KIND)
      .map(worldRectOf)
    for (const tree of solids.trees) {
      for (const rect of rects) {
        const isInside =
          tree.x > rect.minX &&
          tree.x < rect.maxX &&
          tree.z > rect.minZ &&
          tree.z < rect.maxZ
        expect(isInside).toBe(false)
      }
    }
  })
})
