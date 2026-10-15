import { describe, expect, it } from 'vitest'
import { listBiomes } from '../data/biomes'
import { createTerrainChunkSet } from '../terrain/terrainChunkSet'
import {
  copyTerrainRecipe,
  currentTerrainRecipe,
} from '../terrain/terrainHeight'
import { vegetationEntryOf } from './vegetationEntry'

// Os arbustos do chunk, do core (docs/features/055-itens-no-mundo.md).
const BUSH_BIOME = listBiomes().find((biome) =>
  vegetationEntryOf(biome, 'bush'),
)

function chunkSet(seed = 99) {
  const recipe = copyTerrainRecipe({
    ...currentTerrainRecipe(),
    biomeList: [BUSH_BIOME],
  })
  return createTerrainChunkSet({ seed, recipe })
}

// Um chunk com arbustos (eles nascem em manchas).
function coordsWithBushes() {
  const set = chunkSet()
  for (let chunkX = -8; chunkX <= 8; chunkX++) {
    if (set.load(chunkX, 2).bushes.length > 0) return [chunkX, 2]
  }
  throw new Error('nenhum chunk com arbusto')
}

describe('chunk.bushes', () => {
  it('o chunk carregado traz os arbustos, sempre os mesmos pela seed', () => {
    const coords = coordsWithBushes()
    const a = chunkSet().load(...coords).bushes
    const b = chunkSet().load(...coords).bushes
    expect(a.length).toBeGreaterThan(0)
    expect(a).toEqual(b)
  })

  it('dentro do chunk e fora das pegadas dos sólidos', () => {
    const chunk = chunkSet().load(...coordsWithBushes())
    for (const bush of chunk.bushes) {
      expect(bush.x).toBeGreaterThanOrEqual(chunk.minX)
      expect(bush.x).toBeLessThan(chunk.minX + chunk.size)
      expect(bush.z).toBeGreaterThanOrEqual(chunk.minZ)
      expect(bush.z).toBeLessThan(chunk.minZ + chunk.size)
      for (const circle of chunk.solids.footprints) {
        expect(
          Math.hypot(circle.x - bush.x, circle.z - bush.z),
        ).toBeGreaterThanOrEqual(circle.radius)
      }
    }
  })

  it('bioma sem arbusto, nenhum', () => {
    const biome = listBiomes().find(
      (candidate) => !vegetationEntryOf(candidate, 'bush'),
    )
    const recipe = copyTerrainRecipe({
      ...currentTerrainRecipe(),
      biomeList: [biome],
    })
    const chunk = createTerrainChunkSet({ seed: 1, recipe }).load(3, 2)
    expect(chunk.bushes).toEqual([])
  })

  it('o bloco que a view desenha tem os mesmos arbustos que o F vasculha', () => {
    const set = chunkSet()
    const [chunkX, chunkZ] = coordsWithBushes()
    set.load(chunkX, chunkZ)
    const [block] = set.loadedBlocks()
    const chunks = set.loadedChunks()
    const fromChunks = chunks.flatMap((chunk) => chunk.bushes)
    const inLoaded = block.ground.bushes.filter(({ x, z }) =>
      chunks.some(
        (c) =>
          x >= c.minX &&
          x < c.minX + c.size &&
          z >= c.minZ &&
          z < c.minZ + c.size,
      ),
    )
    expect(block.ground.bushes.length).toBeGreaterThan(0)
    expect(fromChunks).toEqual(inLoaded)
  })
})
