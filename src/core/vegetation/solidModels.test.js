import { describe, expect, it } from 'vitest'
import { listBiomes } from '../data/biomes'
import { STANDING_TREE_KINDS, ROCK_KIND } from './solidPlacement'
import LGPE_COLLIDERS from '../data/lgpeColliders.json'
import { dominantBiomeAt, entryOf, lgpeColliderOf } from './solidModels'

// Um chunk de uma célula com dois biomas, o mesmo peso em todo vértice.
const chunkOf = (biomeIds, weights) => ({
  biomeIds,
  biomeWeights: new Float32Array(Array(4).fill(weights).flat()),
  resolution: 1,
  minX: 0,
  minZ: 0,
  size: 1,
})

// Um tipo que um bioma tem e outro não (tirado dos biomas).
function kindOnlyInOne() {
  const biomes = listBiomes()
  for (const owner of biomes) {
    for (const { kind } of owner.vegetation) {
      const other = biomes.find(({ id }) => !entryOf(id, kind))
      if (other) return { kind, owner: owner.id, other: other.id }
    }
  }
  return null
}

describe('modelos por bioma', () => {
  const pair = kindOnlyInOne()

  it('existe um tipo de um bioma só (pré-condição)', () => {
    expect(pair).not.toBeNull()
  })

  it('a planta usa o bioma que tem o tipo, mesmo com o vizinho pesando mais', () => {
    const { kind, owner, other } = pair
    const chunk = chunkOf([other, owner], [0.8, 0.2])
    expect(dominantBiomeAt(chunk, 0.5, 0.5)).toBe(other)
    expect(dominantBiomeAt(chunk, 0.5, 0.5, kind)).toBe(owner)
  })
})

describe('colisor pelo modelo do LGPE', () => {
  const SOLID_KINDS = [...STANDING_TREE_KINDS, ROCK_KIND]
  // Cada sólido de bioma com modelos do LGPE, um por modelo.
  const solidsWithModels = listBiomes().flatMap(({ id, vegetation }) =>
    vegetation
      .filter(({ kind, models }) => SOLID_KINDS.includes(kind) && models)
      .flatMap(({ kind, models }) =>
        models.map((model, index) => ({
          model,
          solid: { kind, biome: id, variant: (index + 0.5) / models.length },
        })),
      ),
  )

  it('algum bioma usa modelo do LGPE num sólido (pré-condição)', () => {
    expect(solidsWithModels.length).toBeGreaterThan(0)
  })

  it('todo modelo do LGPE de árvore ou pedra de bioma tem colisor', () => {
    for (const { model, solid } of solidsWithModels) {
      expect(LGPE_COLLIDERS[model]).toBeDefined()
      expect(lgpeColliderOf(solid)).toBe(LGPE_COLLIDERS[model])
    }
  })

  it('o colisor tem pontos de verdade, da base para cima', () => {
    for (const { points, reach } of Object.values(LGPE_COLLIDERS)) {
      expect(points.length % 3).toBe(0)
      expect(points.length / 3).toBeGreaterThanOrEqual(4)
      const heights = points.filter((_, index) => index % 3 === 1)
      expect(Math.min(...heights)).toBeGreaterThanOrEqual(0)
      expect(Math.max(...heights)).toBeGreaterThan(0)
      expect(reach).toBeGreaterThan(0)
    }
  })

  it('sem modelo do LGPE no bioma, sem colisor do modelo', () => {
    const biome = listBiomes().find(({ vegetation }) =>
      vegetation.some(
        ({ kind, models }) => SOLID_KINDS.includes(kind) && !models,
      ),
    )
    if (!biome) return
    const { kind } = biome.vegetation.find(
      (entry) => SOLID_KINDS.includes(entry.kind) && !entry.models,
    )
    expect(lgpeColliderOf({ kind, biome: biome.id, variant: 0 })).toBeNull()
  })
})
