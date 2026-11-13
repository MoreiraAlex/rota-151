import { describe, expect, it } from 'vitest'
import { GAME_CONFIG } from '../gameConfig'
import { deriveSeed } from '../rng'
import { chunkCoordAt, generateTerrainChunk } from '../terrain/terrainChunk'
import {
  copyTerrainRecipe,
  createTerrainSampler,
  currentTerrainRecipe,
} from '../terrain/terrainHeight'
import { createCityIndex, landmarkIdOf, lotBoundsOf, lotKey } from './cityIndex'
import {
  BUILDING_KIND,
  TRAINING_DUMMY_KIND,
  chunkPlazas,
  chunkTrainingFields,
  placeTown,
  streetStrengthAt,
} from './townPlan'

const recipe = copyTerrainRecipe(currentTerrainRecipe())
// As cidades procedurais ligadas (o jogo, nesta beta, só tem a primeira:
// `CITIES.ONLY_FIRST`, docs/features/069-revisao-do-bioma-cidade.md).
recipe.cities.ONLY_FIRST = false
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

// Os prédios únicos que o porte da cidade pede.
const expectedLandmarkEntries = ({ size, theme }) =>
  [
    ...CITY.town.landmarks.filter((landmark) =>
      size.landmarks.includes(landmarkIdOf(landmark)),
    ),
    size.special ? theme.special : null,
  ].filter(Boolean)

const expectedLandmarks = (city) =>
  expectedLandmarkEntries(city).map(landmarkIdOf).sort()

const landmarkModels = (city) =>
  [...city.landmarks.values()].map(landmarkIdOf).sort()

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
    // Os que são um prédio (o campo de treino é cerca e bonecos).
    const unique = expectedLandmarkEntries(found.city).filter(
      ({ model }) => model,
    )
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

  // O campo de treino (docs/features/067-campo-de-treino-e-avisos-de-
  // nivel.md): o lote do prédio único `field`.
  const fieldLot = () => {
    const [key] = [...found.city.landmarks].find(
      ([, landmark]) => landmark.field,
    )
    const [lotX, lotZ] = key.split(',').map(Number)
    return lotBoundsOf(CITY.town, lotX, lotZ)
  }

  it('o campo de treino tem todos os bonecos, dentro do lote dele', () => {
    const { town } = CITY
    const { sampler, cities: index } = worldIndex()
    const blockSize = recipe.terrain.SOLIDS_BLOCK_SIZE
    const solidBlocks = new Set(
      found.blocks.map(([x, z]) =>
        [
          chunkCoordAt((x + 0.5) * town.blockSize, blockSize),
          chunkCoordAt((z + 0.5) * town.blockSize, blockSize),
        ].join(),
      ),
    )
    const dummies = []
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
      dummies.push(
        ...buildings.filter(({ kind }) => kind === TRAINING_DUMMY_KIND),
      )
    }
    const { columns, rows, dummy } = town.trainingField
    expect(dummies).toHaveLength(columns * rows)
    const [minX, minZ, maxX, maxZ] = fieldLot()
    for (const placed of dummies) {
      expect(placed.model).toBe(dummy)
      expect(placed.x).toBeGreaterThan(minX)
      expect(placed.x).toBeLessThan(maxX)
      expect(placed.z).toBeGreaterThan(minZ)
      expect(placed.z).toBeLessThan(maxZ)
    }
  })

  it('o chão do campo é de terra no meio do lote e nada fora dele', () => {
    const { sampler, cities: index } = worldIndex()
    const [minX, minZ, maxX, maxZ] = fieldLot()
    const size = recipe.terrain.CHUNK_SIZE
    const centerX = (minX + maxX) / 2
    const centerZ = (minZ + maxZ) / 2
    const chunk = generateTerrainChunk(
      sampler,
      chunkCoordAt(centerX, size),
      chunkCoordAt(centerZ, size),
      recipe.terrain,
    )
    const fields = chunkTrainingFields(chunk, {
      biomeList: recipe.biomeList,
      cities: index,
    })
    expect(fields).not.toBeNull()
    const { resolution } = chunk
    const step = chunk.size / resolution
    const valueAt = (x, z) => {
      const ix = Math.round((x - chunk.minX) / step)
      const iz = Math.round((z - chunk.minZ) / step)
      return fields[iz + ix * (resolution + 1)]
    }
    expect(valueAt(centerX, centerZ)).toBe(1)
    for (let ix = 0; ix <= resolution; ix++) {
      for (let iz = 0; iz <= resolution; iz++) {
        const x = chunk.minX + ix * step
        const z = chunk.minZ + iz * step
        const isOutside = x < minX || x > maxX || z < minZ || z > maxZ
        if (isOutside) expect(fields[iz + ix * (resolution + 1)]).toBe(0)
      }
    }
  })

  // A praça (docs/features/069-revisao-do-bioma-cidade.md): o lote do
  // prédio único `plaza`.
  const plazaLot = () => {
    const [key] = [...found.city.landmarks].find(
      ([, landmark]) => landmark.plaza,
    )
    const [lotX, lotZ] = key.split(',').map(Number)
    return lotBoundsOf(CITY.town, lotX, lotZ)
  }

  it('toda cidade tem praça, com a fonte no meio e bancos em volta', () => {
    expect(expectedLandmarks(found.city)).toContain('plaza')
    const { town } = CITY
    const { sampler, cities: index } = worldIndex()
    const [minX, minZ, maxX, maxZ] = plazaLot()
    const centerX = (minX + maxX) / 2
    const centerZ = (minZ + maxZ) / 2
    const blockSize = recipe.terrain.SOLIDS_BLOCK_SIZE
    const chunk = generateTerrainChunk(
      sampler,
      chunkCoordAt(centerX, blockSize),
      chunkCoordAt(centerZ, blockSize),
      { ...recipe.terrain, CHUNK_SIZE: blockSize },
    )
    const { buildings } = placeTown(chunk, {
      seed: SEED,
      biomeList: recipe.biomeList,
      terrain: recipe.terrain,
      cities: index,
    })
    const inside = buildings.filter(
      ({ x, z }) => x > minX && x < maxX && z > minZ && z < maxZ,
    )
    const fountains = inside.filter(
      ({ model }) => model === town.props.fountain,
    )
    expect(fountains).toHaveLength(1)
    expect(fountains[0].x).toBeCloseTo(centerX)
    expect(fountains[0].z).toBeCloseTo(centerZ)
    const benches = inside.filter(({ model }) => model === town.props.bench)
    expect(benches.length).toBeGreaterThan(0)
    // Cada banco virado para a fonte (a frente, +Z do modelo, aponta para
    // o meio).
    for (const bench of benches) {
      const toCenter = Math.atan2(centerX - bench.x, centerZ - bench.z)
      expect(Math.cos(bench.yaw - toCenter)).toBeCloseTo(1)
    }
  })

  it('o chão da praça é calçado no meio do lote e nada fora dele', () => {
    const { sampler, cities: index } = worldIndex()
    const [minX, minZ, maxX, maxZ] = plazaLot()
    const size = recipe.terrain.CHUNK_SIZE
    const centerX = (minX + maxX) / 2
    const centerZ = (minZ + maxZ) / 2
    const chunk = generateTerrainChunk(
      sampler,
      chunkCoordAt(centerX, size),
      chunkCoordAt(centerZ, size),
      recipe.terrain,
    )
    const plazas = chunkPlazas(chunk, {
      biomeList: recipe.biomeList,
      cities: index,
    })
    expect(plazas).not.toBeNull()
    const { resolution } = chunk
    const step = chunk.size / resolution
    const ix = Math.round((centerX - chunk.minX) / step)
    const iz = Math.round((centerZ - chunk.minZ) / step)
    expect(plazas[iz + ix * (resolution + 1)]).toBe(1)
    for (let i = 0; i <= resolution; i++) {
      for (let j = 0; j <= resolution; j++) {
        const x = chunk.minX + i * step
        const z = chunk.minZ + j * step
        const isOutside = x < minX || x > maxX || z < minZ || z > maxZ
        if (isOutside) expect(plazas[j + i * (resolution + 1)]).toBe(0)
      }
    }
  })

  it('sem o índice de cidades não há chão de praça', () => {
    const { sampler } = worldIndex()
    const chunk = generateTerrainChunk(sampler, 0, 0, recipe.terrain)
    expect(
      chunkPlazas(chunk, { biomeList: recipe.biomeList, cities: null }),
    ).toBeNull()
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

  it.runIf(!GAME_CONFIG.CITIES.FIRST_TOWN.LAYOUT)(
    'o treinador nasce numa rua da primeira cidade, do primeiro porte',
    () => {
      const { sampler, cities: index } = worldIndex()
      expect(sampler.biomeAt(0, 0)).toBe(CITY)
      expect(streetStrengthAt(CITY.town, 0, 0)).toBe(1)
      const city = index.cityOf(0, 0)
      expect(city.id).toBe(sampler.cities.cityAt(0, 0).id)
      expect(city.size.id).toBe(GAME_CONFIG.CITIES.FIRST_SIZE)
    },
  )

  // Com a primeira cidade fixa (docs/features/069-revisao-do-bioma-
  // cidade.md — Viridian, montada à mão), o layout dela é a cidade toda:
  // nenhum lote.
  it.runIf(Boolean(GAME_CONFIG.CITIES.FIRST_TOWN.LAYOUT))(
    'o treinador nasce na cidade fixa, sem lotes da cidade procedural',
    () => {
      const { sampler, cities: index } = worldIndex()
      const first = sampler.cities.cityAt(0, 0)
      expect(first.fixed).toBe(true)
      expect(sampler.biomeAt(0, 0)).toBe(CITY)
      const { lotsPerSide, blockSize, streetWidth } = CITY.town
      const lotSize = (blockSize - streetWidth) / lotsPerSide
      const reach = Math.ceil(first.radius / lotSize)
      for (let lotX = -reach; lotX <= reach; lotX++) {
        for (let lotZ = -reach; lotZ <= reach; lotZ++) {
          const [minX, minZ, maxX, maxZ] = lotBoundsOf(CITY.town, lotX, lotZ)
          const near = sampler.cities.nearestCity(
            (minX + maxX) / 2,
            (minZ + maxZ) / 2,
          )
          if (near.city !== first) continue
          expect(index.isLotOpen(lotX, lotZ)).toBe(false)
        }
      }
    },
  )

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
