import { afterEach, describe, expect, it } from 'vitest'
import { listBiomes } from '../data/biomes'
import { TEST_LEVEL } from '../data/testLevel'
import { GAME_CONFIG } from '../gameConfig'
import { carregarChunk, descarregarTodosOsChunks } from './chunks'
import {
  levelTerrainWaterDepthAt,
  levelWaterDepthAt,
  levelWaterSurfaceAt,
} from './water'

const CITY = listBiomes().find(({ town }) => town?.plaza?.water)

afterEach(() => descarregarTodosOsChunks())

// Um chunk carregado com uma fonte posta no meio dele (antes de qualquer
// pergunta: a lista de fontes do chunk fica guardada) — longe da origem,
// fora da cidade fixa (069).
const FAR_CHUNK = 20
function chunkWithFountain() {
  carregarChunk(FAR_CHUNK, FAR_CHUNK)
  const chunk = TEST_LEVEL.terrain.loadedChunks()[0]
  const x = chunk.minX + chunk.size / 2
  const z = chunk.minZ + chunk.size / 2
  const { town } = CITY
  const ground = TEST_LEVEL.terrain.heightAt(x, z)
  chunk.solids.buildings.push({
    kind: 'street-prop',
    model: town.props.fountain,
    biome: CITY.id,
    x,
    y: ground - town.plaza.fountainSink,
    z,
    yaw: 0,
    scale: town.propScale,
  })
  return { x, z, ground, water: town.plaza.water }
}

describe.runIf(CITY)('a água das fontes no nível', () => {
  it('dentro da fonte há água rasa, na superfície dela', () => {
    const { x, z, ground, water } = chunkWithFountain()
    expect(levelWaterDepthAt(x, z)).toBeGreaterThanOrEqual(water.depth)
    expect(levelWaterSurfaceAt(x, z)).toBeCloseTo(ground + water.depth)
  })

  it('fora da fonte, a água é só a do relevo', () => {
    const { x, z } = chunkWithFountain()
    const far = x + CITY.town.blockSize
    expect(levelWaterDepthAt(far, z)).toBe(levelTerrainWaterDepthAt(far, z))
    expect(levelWaterSurfaceAt(far, z)).toBe(GAME_CONFIG.TERRAIN.WATER_LEVEL)
  })
})

// A cidade fixa no mundo (docs/features/069-revisao-do-bioma-cidade.md —
// Viridian, montada à mão): o lago dela conta como os lagos do mundo.
const FIXED_TOWN = TEST_LEVEL.terrain.fixedTown?.() ?? null

describe.runIf(FIXED_TOWN?.lake)('a água da cidade fixa', () => {
  it('no meio do lago há água, na superfície dele', () => {
    const [minX, minZ, maxX, maxZ] = FIXED_TOWN.lake.rect
    const x = (minX + maxX) / 2
    const z = (minZ + maxZ) / 2
    expect(levelWaterDepthAt(x, z)).toBeGreaterThan(0)
    expect(levelWaterSurfaceAt(x, z)).toBeCloseTo(FIXED_TOWN.lake.surface)
  })

  it('onde o treinador nasce, seco', () => {
    const { x, z } = FIXED_TOWN.spawn
    expect(levelWaterDepthAt(x, z)).toBeLessThanOrEqual(0)
  })
})
