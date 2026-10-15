import { describe, expect, it } from 'vitest'
import { GAME_CONFIG } from '../gameConfig'
import { deriveSeed } from '../rng'
import { chunkCoordAt, generateTerrainChunk } from '../terrain/terrainChunk'
import {
  copyTerrainRecipe,
  createTerrainSampler,
  currentTerrainRecipe,
} from '../terrain/terrainHeight'
import { createCityIndex, lotBoundsOf, lotKey } from './cityIndex'
import { BUILDING_KIND, placeTown, streetStrengthAt } from './townPlan'

const recipe = copyTerrainRecipe(currentTerrainRecipe())
const CITY = recipe.biomeList.find(({ town }) => town)
const SEED = deriveSeed(GAME_CONFIG.WORLD.SEED, 'terrain')

// O índice do mundo, pelo relevo da seed (como o conjunto de chunks monta).
function worldIndex(seed = SEED) {
  const sampler = createTerrainSampler(seed, recipe)
  const isTown = recipe.biomeList.map(({ town }) => Boolean(town))
  const weights = new Float64Array(recipe.biomeList.length)
  return {
    sampler,
    cities: createCityIndex({
      seed,
      town: CITY.town,
      terrain: recipe.terrain,
      shareAt(x, z) {
        sampler.sample(x, z, weights)
        return weights.reduce((sum, w, i) => sum + (isTown[i] ? w : 0), 0)
      },
      heightAt: (x, z) => sampler.sample(x, z),
      sites: sampler.cities,
    }),
  }
}

// Os modelos dos prédios únicos que o porte da cidade pede.
const expectedLandmarks = ({ size, theme }) =>
  [
    ...CITY.town.landmarks.filter(({ model }) =>
      size.landmarks.includes(model),
    ),
    size.special ? theme.special : null,
  ]
    .filter(Boolean)
    .map(({ model }) => model)
    .sort()

const landmarkModels = (city) =>
  [...city.landmarks.values()].map(({ model }) => model).sort()

// O quarteirão do meio de uma cidade da seed.
const blockAt = (x, z) => [
  Math.floor(x / CITY.town.blockSize),
  Math.floor(z / CITY.town.blockSize),
]

// Os quarteirões da primeira cidade achada numa volta em espiral da origem.
function firstCity(cities) {
  const { blockSize } = CITY.town
  for (let ring = 0; ring < 80; ring++) {
    for (let bx = -ring; bx <= ring; bx++) {
      for (let bz = -ring; bz <= ring; bz++) {
        if (Math.max(Math.abs(bx), Math.abs(bz)) !== ring) continue
        const city = cities.cityOf(bx, bz)
        if (!city || city.landmarks.size === 0) {
          continue
        }
        // Todos os quarteirões dela (os vizinhos com o mesmo id).
        const blocks = []
        const queue = [[bx, bz]]
        const seen = new Set([`${bx},${bz}`])
        while (queue.length > 0) {
          const [x, z] = queue.pop()
          blocks.push([x, z])
          for (const [dx, dz] of [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
          ]) {
            const key = `${x + dx},${z + dz}`
            if (seen.has(key)) continue
            seen.add(key)
            if (cities.cityOf(x + dx, z + dz)?.id === city.id) {
              queue.push([x + dx, z + dz])
            }
          }
        }
        return { city, blocks, blockSize }
      }
    }
  }
  return null
}

describe.runIf(CITY)('lotBoundsOf', () => {
  it('o lote fica dentro do quarteirão, fora da rua', () => {
    const { town } = CITY
    for (const [lotX, lotZ] of [
      [0, 0],
      [3, -5],
      [-7, 2],
    ]) {
      const [minX, minZ, maxX, maxZ] = lotBoundsOf(town, lotX, lotZ)
      expect(maxX).toBeGreaterThan(minX)
      for (const [x, z] of [
        [minX, minZ],
        [maxX, maxZ],
        [(minX + maxX) / 2, (minZ + maxZ) / 2],
      ]) {
        expect(streetStrengthAt(town, x, z)).toBeLessThan(1)
      }
      expect(Math.floor(minX / town.blockSize)).toBe(
        Math.floor((maxX - 1e-6) / town.blockSize),
      )
    }
  })
})

describe.runIf(CITY)('createCityIndex', () => {
  const { cities } = worldIndex()
  const found = firstCity(cities)

  it('acha uma cidade na seed do jogo', () => {
    expect(found).not.toBeNull()
  })

  it('a cidade é a mesma (id e prédios) de qualquer quarteirão dela', () => {
    const fresh = worldIndex().cities
    for (const [x, z] of found.blocks) {
      const city = fresh.cityOf(x, z)
      expect(city.id).toBe(found.city.id)
      expect([...city.landmarks.keys()]).toEqual([
        ...found.city.landmarks.keys(),
      ])
    }
  })

  it('cada prédio único fica num lote aberto, um por lote', () => {
    const lots = [...found.city.landmarks.keys()]
    expect(new Set(lots).size).toBe(lots.length)
    for (const key of lots) {
      const [lotX, lotZ] = key.split(',').map(Number)
      expect(cities.isLotOpen(lotX, lotZ)).toBe(true)
      expect(lotKey(lotX, lotZ)).toBe(key)
    }
  })

  it('a cidade inteira tem um de cada prédio único; o resto são casas', () => {
    const { town } = CITY
    const { sampler, cities: index } = worldIndex()
    const blockSize = recipe.terrain.SOLIDS_BLOCK_SIZE
    // O bloco de sólidos de cada quarteirão (pelo meio dele).
    const solidBlocks = new Set(
      found.blocks.map(([x, z]) =>
        [
          chunkCoordAt((x + 0.5) * town.blockSize, blockSize),
          chunkCoordAt((z + 0.5) * town.blockSize, blockSize),
        ].join(),
      ),
    )
    const count = new Map()
    const { theme } = found.city
    const houses = theme.houses.map(({ model }) => model)
    const unique = expectedLandmarks(found.city).map((model) => ({ model }))
    for (const key of solidBlocks) {
      const [bx, bz] = key.split(',').map(Number)
      const chunk = generateTerrainChunk(sampler, bx, bz, {
        ...recipe.terrain,
        CHUNK_SIZE: blockSize,
      })
      const { buildings } = placeTown(chunk, {
        seed: SEED,
        biomeList: recipe.biomeList,
        terrain: recipe.terrain,
        cities: index,
      })
      for (const { kind, model, x, z } of buildings) {
        if (kind !== BUILDING_KIND) continue
        const block = [
          Math.floor(x / town.blockSize),
          Math.floor(z / town.blockSize),
        ]
        if (index.cityOf(...block)?.id !== found.city.id) continue
        count.set(model, (count.get(model) ?? 0) + 1)
      }
    }
    for (const { model } of unique) expect(count.get(model)).toBe(1)
    const others = [...count.keys()].filter(
      (model) => !unique.some((landmark) => landmark.model === model),
    )
    for (const model of others) expect(houses).toContain(model)
  })

  it('o id e o porte são os da cidade da seed', () => {
    const { sampler, cities: index } = worldIndex()
    for (let cell = -2; cell <= 2; cell++) {
      const site = sampler.cities.cityAt(cell, 1)
      const city = index.cityOf(...blockAt(site.x, site.z))
      expect(city.id).toBe(site.id)
      expect(city.size).toBe(site.size)
    }
  })

  it('o porte decide os prédios únicos', () => {
    const { sampler, cities: index } = worldIndex()
    const seen = new Set()
    for (let i = 0; i < 25 && seen.size < CITY.town.sizes.length; i++) {
      const site = sampler.cities.cityAt((i % 5) - 2, Math.floor(i / 5) - 2)
      const city = index.cityOf(...blockAt(site.x, site.z))
      expect(landmarkModels(city)).toEqual(expectedLandmarks(city))
      seen.add(city.size.id)
    }
    expect(seen.size).toBe(CITY.town.sizes.length)
  })

  it('o treinador nasce numa rua da primeira cidade, do primeiro porte', () => {
    const { sampler, cities: index } = worldIndex()
    expect(sampler.biomeAt(0, 0)).toBe(CITY)
    expect(streetStrengthAt(CITY.town, 0, 0)).toBe(1)
    const city = index.cityOf(0, 0)
    expect(city.id).toBe(sampler.cities.cityAt(0, 0).id)
    expect(city.size.id).toBe(GAME_CONFIG.CITIES.FIRST_SIZE)
  })

  it('cada cidade segue um tema da lista, o mesmo de qualquer quarteirão', () => {
    expect(CITY.town.themes).toContain(found.city.theme)
    for (const [x, z] of found.blocks) {
      expect(cities.cityOf(x, z).theme).toBe(found.city.theme)
    }
    const [x, z] = found.blocks[0]
    const { blockSize } = CITY.town
    expect(cities.themeNear((x + 0.5) * blockSize, (z + 0.5) * blockSize)).toBe(
      found.city.theme,
    )
  })

  it('o tema sai pela seed: seeds diferentes dão temas variados', () => {
    const themes = new Set()
    for (let seed = 1; seed <= 40 && themes.size < 2; seed++) {
      const index = createCityIndex({
        seed,
        town: CITY.town,
        terrain: recipe.terrain,
        shareAt: () => 1,
        heightAt: () => 10,
        bounds: [0, 0, CITY.town.blockSize, CITY.town.blockSize],
      })
      themes.add(index.cityOf(0, 0)?.theme.id)
    }
    expect(themes.size).toBeGreaterThan(1)
  })

  it('pedaço com poucos lotes não ganha prédio único', () => {
    const { blockSize, lotsPerSide } = CITY.town
    // Um quarteirão só aberto (os vizinhos fora da cidade).
    const index = createCityIndex({
      seed: SEED,
      town: CITY.town,
      terrain: recipe.terrain,
      shareAt: (x, z) =>
        x > 10 * blockSize && x < 11 * blockSize && z > 0 && z < blockSize
          ? 1
          : 0,
      heightAt: () => 10,
    })
    const city = index.cityOf(10, 0)
    expect(lotsPerSide * lotsPerSide).toBeLessThan(
      GAME_CONFIG.TOWN.MIN_CITY_LOTS,
    )
    expect(city.landmarks.size).toBe(0)
  })

  it('quarteirão sem lote aberto não é de cidade', () => {
    const { blockSize } = CITY.town
    const index = createCityIndex({
      seed: SEED,
      town: CITY.town,
      terrain: recipe.terrain,
      shareAt: () => 0,
      heightAt: () => 10,
    })
    expect(index.cityOf(5, 5)).toBeNull()
    expect(blockSize).toBeGreaterThan(0)
  })
})
