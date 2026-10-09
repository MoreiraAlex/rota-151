import { describe, expect, it } from 'vitest'
import { generateTerrainChunk, heightIndex } from '../terrain/terrainChunk'
import {
  copyTerrainRecipe,
  createTerrainSampler,
  currentTerrainRecipe,
} from '../terrain/terrainHeight'
import { grassClusterAt } from './grassClusters'
import { patchAt } from './patches'
import {
  createKindDensity,
  densityAt,
  kindDensities,
  slopeAt,
} from './vegetationDensity'

const recipe = copyTerrainRecipe(currentTerrainRecipe())
const sampler = createTerrainSampler(21, recipe)
const chunk = generateTerrainChunk(sampler, 3, -1, recipe.terrain)
const step = chunk.size / chunk.resolution

// Um tipo declarado por algum bioma do registro.
const someKind = recipe.biomeList[0].vegetation[0].kind

describe('kindDensities', () => {
  it('a density de cada bioma do chunk, 0 onde ele não tem o tipo', () => {
    const densities = kindDensities(recipe.biomeList, chunk.biomeIds, someKind)
    chunk.biomeIds.forEach((id, index) => {
      const biome = recipe.biomeList.find((candidate) => candidate.id === id)
      const entry = biome.vegetation.find(({ kind }) => kind === someKind)
      expect(densities[index]).toBeCloseTo(entry?.density ?? 0)
    })
    expect(
      kindDensities(recipe.biomeList, chunk.biomeIds, 'nao-existe').every(
        (density) => density === 0,
      ),
    ).toBe(true)
  })
})

describe('densityAt', () => {
  it('num vértice: soma de peso × densidade dos biomas', () => {
    const densities = kindDensities(recipe.biomeList, chunk.biomeIds, someKind)
    const count = chunk.biomeIds.length
    const { resolution } = chunk
    for (const [ix, iz] of [
      [1, 2],
      [Math.floor(resolution / 3), Math.floor((resolution * 2) / 3)],
      [Math.floor(resolution / 2), Math.floor(resolution / 2)],
    ]) {
      const base = heightIndex(chunk.resolution, ix, iz) * count
      let expected = 0
      for (let biome = 0; biome < count; biome++) {
        expected += (chunk.biomeWeights[base + biome] / 255) * densities[biome]
      }
      const x = chunk.minX + ix * step
      const z = chunk.minZ + iz * step
      expect(densityAt(chunk, densities, x, z)).toBeCloseTo(expected, 5)
    }
  })

  it('fica entre 0 e a maior densidade', () => {
    const densities = kindDensities(recipe.biomeList, chunk.biomeIds, someKind)
    const max = Math.max(...densities)
    for (let i = 0; i < 50; i++) {
      const x = chunk.minX + ((i * 7.3) % chunk.size)
      const z = chunk.minZ + ((i * 3.1) % chunk.size)
      const density = densityAt(chunk, densities, x, z)
      expect(density).toBeGreaterThanOrEqual(0)
      expect(density).toBeLessThanOrEqual(max + 1e-6)
    }
  })
})

describe('slopeAt', () => {
  it('chão plano: 0; rampa: o ângulo dela', () => {
    const flat = { ...chunk, heights: new Float32Array(chunk.heights.length) }
    expect(slopeAt(flat, chunk.minX + 5.5, chunk.minZ + 5.5)).toBeCloseTo(0)

    const rise = 0.5
    const ramp = { ...chunk, heights: new Float32Array(chunk.heights.length) }
    for (let ix = 0; ix <= chunk.resolution; ix++) {
      for (let iz = 0; iz <= chunk.resolution; iz++) {
        ramp.heights[heightIndex(chunk.resolution, ix, iz)] = ix * step * rise
      }
    }
    expect(slopeAt(ramp, chunk.minX + 5.5, chunk.minZ + 5.5)).toBeCloseTo(
      Math.atan(rise),
    )
  })
})

describe('createKindDensity (clareiras)', () => {
  // Um bioma só, com clareira, e três tipos: um de sombra, um de clareira
  // e um sem lugar.
  const biome = {
    id: 'teste',
    clearings: { amount: 0.4 },
    vegetation: [
      { kind: 'sombra', density: 0.8, place: 'shade' },
      { kind: 'clareira', density: 0.8, place: 'clearing' },
      { kind: 'livre', density: 0.8 },
    ],
  }
  const single = {
    ...chunk,
    biomeIds: ['teste'],
    biomeWeights: new Uint8Array(chunk.heights.length).fill(255),
  }
  const options = { biomeList: [biome], seed: 3 }
  const points = Array.from({ length: 200 }, (_, i) => [
    single.minX + ((i * 7.7) % single.size),
    single.minZ + ((i * 3.3) % single.size),
  ])

  it('sombra + clareira = a densidade cheia em qualquer ponto', () => {
    const shade = createKindDensity(single, 'sombra', options)
    const open = createKindDensity(single, 'clareira', options)
    for (const [x, z] of points) {
      expect(shade.at(x, z) + open.at(x, z)).toBeCloseTo(0.8, 4)
    }
  })

  it('de clareira com `shade`: essa fração fica até na mata fechada', () => {
    const partial = {
      ...biome,
      vegetation: [
        { kind: 'meio', density: 0.8, place: 'clearing', shade: 0.25 },
      ],
    }
    const density = createKindDensity(single, 'meio', {
      biomeList: [partial],
      seed: 3,
    })
    for (const [x, z] of points) {
      expect(density.at(x, z)).toBeGreaterThanOrEqual(0.8 * 0.25 - 1e-4)
      expect(density.at(x, z)).toBeLessThanOrEqual(0.8 + 1e-4)
    }
  })

  it('tipo sem lugar não muda com a clareira', () => {
    const free = createKindDensity(single, 'livre', options)
    for (const [x, z] of points) expect(free.at(x, z)).toBeCloseTo(0.8, 4)
  })

  it('bioma sem clareira: o tipo de clareira nasce em qualquer lugar', () => {
    const noClearings = { ...biome, clearings: undefined }
    const open = createKindDensity(single, 'clareira', {
      biomeList: [noClearings],
      seed: 3,
    })
    for (const [x, z] of points) expect(open.at(x, z)).toBeCloseTo(0.8, 4)
  })

  it('tipo que o bioma não tem: vazio', () => {
    expect(createKindDensity(single, 'nao-existe', options).isEmpty).toBe(true)
  })
})

describe('createKindDensity (manchas)', () => {
  const patches = { amount: 0.4, size: 12 }
  const biome = {
    id: 'teste',
    clearings: { amount: 0.4 },
    vegetation: [
      { kind: 'mancha', density: 0.8, patches },
      { kind: 'sombra', density: 0.8, place: 'shade' },
      { kind: 'sombra-mancha', density: 0.8, place: 'shade', patches },
    ],
  }
  const single = {
    ...chunk,
    biomeIds: ['teste'],
    biomeWeights: new Uint8Array(chunk.heights.length).fill(255),
  }
  const options = { biomeList: [biome], seed: 3 }
  const points = Array.from({ length: 200 }, (_, i) => [
    single.minX + ((i * 7.7) % single.size),
    single.minZ + ((i * 3.3) % single.size),
  ])

  it('a densidade do bioma só dentro da mancha do tipo', () => {
    const density = createKindDensity(single, 'mancha', options)
    for (const [x, z] of points) {
      const inside = patchAt(3, 'mancha', patches, x, z)
      expect(density.at(x, z)).toBeCloseTo(0.8 * inside, 4)
    }
  })

  it('mancha e clareira juntas: as duas reduzem', () => {
    const shade = createKindDensity(single, 'sombra', options)
    const both = createKindDensity(single, 'sombra-mancha', options)
    for (const [x, z] of points) {
      const inside = patchAt(3, 'sombra-mancha', patches, x, z)
      expect(both.at(x, z)).toBeCloseTo(shade.at(x, z) * inside, 4)
    }
  })
})

describe('createKindDensity (conjuntos de grama)', () => {
  const clusters = {
    density: 1,
    size: 10,
    sizeVariation: 0.4,
    roughness: 0.4,
    edge: 0.05,
    height: 1.3,
    holes: 0,
    coverage: 0.4,
    grouping: 0.2,
    variety: 0.3,
    background: 0.1,
    backgroundHeight: 0.6,
    clearingPreference: 0,
  }
  const biome = {
    id: 'teste',
    vegetation: [{ kind: 'grama', density: 0.8, clusters }],
  }
  const single = {
    ...chunk,
    biomeIds: ['teste'],
    biomeWeights: new Uint8Array(chunk.heights.length).fill(255),
  }
  const density = createKindDensity(single, 'grama', {
    biomeList: [biome],
    seed: 3,
  })
  const points = Array.from({ length: 200 }, (_, i) => [
    single.minX + ((i * 7.7) % single.size),
    single.minZ + ((i * 3.3) % single.size),
  ])

  it('a densidade e a altura do conjunto (nos cantos da grade dele)', () => {
    for (const [x, z] of points.map(([px, pz]) => [
      Math.floor(px),
      Math.floor(pz),
    ])) {
      const cluster = grassClusterAt(3, clusters, x, z)
      expect(density.at(x, z)).toBeCloseTo(0.8 * cluster.density, 4)
      expect(density.heightAt(x, z)).toBeCloseTo(cluster.height, 4)
    }
  })

  it('sem conjuntos: altura de sempre', () => {
    const plain = createKindDensity(single, 'grama', {
      biomeList: [{ id: 'teste', vegetation: [{ kind: 'grama', density: 1 }] }],
      seed: 3,
    })
    for (const [x, z] of points) expect(plain.heightAt(x, z)).toBe(1)
  })
})
