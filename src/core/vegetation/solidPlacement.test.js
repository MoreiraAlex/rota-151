import { describe, expect, it } from 'vitest'
import { listBiomes } from '../data/biomes'
import { GAME_CONFIG } from '../gameConfig'
import { chunkHeightAt, generateTerrainChunk } from '../terrain/terrainChunk'
import {
  copyTerrainRecipe,
  createTerrainSampler,
  currentTerrainRecipe,
} from '../terrain/terrainHeight'
import { slopeAt } from './vegetationDensity'
import {
  LOG_KIND,
  ROCK_KIND,
  STANDING_TREE_KINDS,
  TREE_KIND,
  borderGapOf,
  footprintOf,
  placeChunkSolids,
  specOf,
} from './solidPlacement'

const { TERRAIN } = GAME_CONFIG
const GROUPS = ['trees', 'logs', 'rocks']
const SOLID_KINDS = [...STANDING_TREE_KINDS, LOG_KIND, ROCK_KIND]

// Todos os objetos do chunk, de todos os grupos (cada um com o `kind`).
const allOf = (solids) => GROUPS.flatMap((group) => solids[group])

// Mundo só com os biomas `ids` (do registro inteiro — a receita do jogo
// pode estar com biomas escondidos, `BIOMES.HIDDEN`), com `edit` aplicado à
// receita copiada.
function worldOf(ids, edit = () => {}) {
  const recipe = copyTerrainRecipe({
    ...currentTerrainRecipe(),
    biomeList: listBiomes().filter(({ id }) => ids.includes(id)),
  })
  edit(recipe)
  return recipe
}

function solidsOf(recipe, seed, chunkX, chunkZ) {
  const sampler = createTerrainSampler(seed, recipe)
  const chunk = generateTerrainChunk(sampler, chunkX, chunkZ, recipe.terrain)
  const solids = placeChunkSolids(chunk, {
    seed,
    biomeList: recipe.biomeList,
    terrain: recipe.terrain,
    params: recipe.solids,
  })
  return { chunk, solids }
}

// Um bioma do registro com árvore, tronco caído e pedra.
const withAllSolids = listBiomes().find(({ vegetation }) =>
  [TREE_KIND, LOG_KIND, ROCK_KIND].every((kind) =>
    vegetation.some((entry) => entry.kind === kind),
  ),
)

const CHUNKS = [
  [1, 0],
  [-2, 3],
  [4, -1],
]

describe.runIf(withAllSolids)('placeChunkSolids', () => {
  const world = worldOf([withAllSolids.id])
  const params = world.solids

  it('mesma seed e chunk: os mesmos objetos; seed diferente: outros', () => {
    const first = solidsOf(world, 7, 2, 1).solids
    expect(first.trees.length).toBeGreaterThan(0)
    expect(solidsOf(world, 7, 2, 1).solids).toEqual(first)
    expect(solidsOf(world, 8, 2, 1).solids.trees).not.toEqual(first.trees)
  })

  it.each(CHUNKS)(
    'chunk (%i, %i): nada na água, em encosta, na origem ou na borda',
    (chunkX, chunkZ) => {
      const { chunk, solids } = solidsOf(world, 11, chunkX, chunkZ)
      for (const item of allOf(solids)) {
        const spec = specOf(item.kind, params)
        const gap = borderGapOf(item.kind, params)
        expect(item.y).toBeGreaterThanOrEqual(
          TERRAIN.WATER_LEVEL + spec.SHORE_GAP,
        )
        expect(slopeAt(chunk, item.x, item.z)).toBeLessThanOrEqual(
          spec.MAX_SLOPE,
        )
        expect(Math.hypot(item.x, item.z)).toBeGreaterThanOrEqual(
          GAME_CONFIG.TREES.SPAWN_CLEAR_RADIUS,
        )
        expect(item.x).toBeGreaterThanOrEqual(chunk.minX + gap)
        expect(item.x).toBeLessThan(chunk.minX + chunk.size - gap)
        expect(item.z).toBeGreaterThanOrEqual(chunk.minZ + gap)
        expect(item.z).toBeLessThan(chunk.minZ + chunk.size - gap)
        expect(item.scale).toBeGreaterThanOrEqual(spec.SCALE[0])
        expect(item.scale).toBeLessThanOrEqual(spec.SCALE[1])
      }
    },
  )

  it('tronco caído com as duas pontas quase na mesma altura', () => {
    for (const [chunkX, chunkZ] of CHUNKS) {
      const { chunk, solids } = solidsOf(world, 13, chunkX, chunkZ)
      for (const log of solids.logs) {
        const circles = footprintOf(LOG_KIND, log, params)
        const [start, end] = [circles[0], circles.at(-1)]
        const drop = Math.abs(
          chunkHeightAt(chunk, start.x, start.z) -
            chunkHeightAt(chunk, end.x, end.z),
        )
        expect(drop).toBeLessThanOrEqual(GAME_CONFIG.LOGS.MAX_END_DROP + 1e-6)
      }
    }
  })

  it('a pegada de cada objeto fica dentro do chunk (navegação por chunk)', () => {
    const { chunk, solids } = solidsOf(world, 3, 1, 1)
    for (const circle of solids.footprints) {
      expect(circle.x - circle.radius).toBeGreaterThan(chunk.minX)
      expect(circle.x + circle.radius).toBeLessThan(chunk.minX + chunk.size)
      expect(circle.z - circle.radius).toBeGreaterThan(chunk.minZ)
      expect(circle.z + circle.radius).toBeLessThan(chunk.minZ + chunk.size)
    }
  })

  it('cada árvore é de uma espécie que o bioma declara', () => {
    const declared = withAllSolids.vegetation.map(({ kind }) => kind)
    const { solids } = solidsOf(world, 7, 2, 1)
    for (const tree of solids.trees) {
      expect(STANDING_TREE_KINDS).toContain(tree.kind)
      expect(declared).toContain(tree.kind)
    }
    expect(solids.logs.every(({ kind }) => kind === LOG_KIND)).toBe(true)
    expect(solids.rocks.every(({ kind }) => kind === ROCK_KIND)).toBe(true)
  })

  it('nenhum tronco nasce dentro da copa de outra árvore', () => {
    for (const [chunkX, chunkZ] of CHUNKS) {
      const { trees } = solidsOf(world, 12, chunkX, chunkZ).solids
      for (const a of trees) {
        for (const b of trees) {
          if (a === b) continue
          const crown = specOf(a.kind, params).CROWN_RADIUS * a.scale
          expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeGreaterThanOrEqual(crown)
        }
      }
    }
  })

  it('objetos não nascem encostados uns nos outros', () => {
    const { solids } = solidsOf(world, 5, 2, 2)
    const all = allOf(solids).map((item) =>
      footprintOf(item.kind, item, params),
    )
    for (let a = 0; a < all.length; a++) {
      for (let b = a + 1; b < all.length; b++) {
        for (const p of all[a]) {
          for (const q of all[b]) {
            expect(Math.hypot(p.x - q.x, p.z - q.z)).toBeGreaterThanOrEqual(
              p.radius + q.radius,
            )
          }
        }
      }
    }
  })

  it('as pegadas guardadas são as de todos os objetos', () => {
    const { solids } = solidsOf(world, 6, 1, 2)
    const expected = allOf(solids).reduce(
      (count, item) => count + footprintOf(item.kind, item, params).length,
      0,
    )
    expect(solids.footprints).toHaveLength(expected)
  })

  it('chunks vizinhos não repetem objeto', () => {
    const seen = new Set()
    for (const [chunkX, chunkZ] of [
      [1, 1],
      [2, 1],
      [1, 2],
      [2, 2],
    ]) {
      const { solids } = solidsOf(world, 4, chunkX, chunkZ)
      for (const { x, z } of [...solids.trees, ...solids.rocks]) {
        const key = `${x},${z}`
        expect(seen.has(key)).toBe(false)
        seen.add(key)
      }
    }
  })

  it('mais densidade no bioma, mais árvores', () => {
    const withDensity = (density) =>
      worldOf([withAllSolids.id], (recipe) => {
        const entry = recipe.biomeList[0].vegetation.find(
          ({ kind }) => kind === TREE_KIND,
        )
        entry.density = density
      })
    const count = (recipe) =>
      CHUNKS.reduce(
        (sum, [chunkX, chunkZ]) =>
          sum + solidsOf(recipe, 9, chunkX, chunkZ).solids.trees.length,
        0,
      )
    expect(count(withDensity(0.8))).toBeGreaterThan(count(withDensity(0.2)))
  })
})

describe('placeChunkSolids — cada espécie de árvore', () => {
  // Um bioma do registro que declara a espécie.
  const biomeWith = (kind) =>
    listBiomes().find(({ vegetation }) =>
      vegetation.some((entry) => entry.kind === kind),
    )

  it.each(STANDING_TREE_KINDS)('%s tem números no config', (kind) => {
    const spec = specOf(kind, currentTerrainRecipe().solids)
    for (const key of ['SPACING', 'CHANCE', 'TRUNK_RADIUS', 'CROWN_RADIUS']) {
      expect(spec[key]).toBeGreaterThan(0)
    }
    expect(spec.SCALE[1]).toBeGreaterThanOrEqual(spec.SCALE[0])
  })

  it.each(STANDING_TREE_KINDS.filter(biomeWith))(
    '%s nasce no bioma que a declara',
    (kind) => {
      // Só a espécie, em todo lugar do bioma: sem as outras árvores
      // disputando o chão, nem manchas ou sombra limitando.
      const world = worldOf([biomeWith(kind).id], (recipe) => {
        const biome = recipe.biomeList[0]
        biome.vegetation = biome.vegetation
          .filter((entry) => entry.kind === kind)
          .map(({ kind: only }) => ({ kind: only, density: 1 }))
      })
      // Uma área maior que `CHUNKS`: as árvores grandes têm células de
      // mais de um chunk.
      const area = Array.from({ length: 36 }, (_, i) => [
        i % 6,
        Math.floor(i / 6),
      ])
      const trees = area.flatMap(
        ([chunkX, chunkZ]) => solidsOf(world, 21, chunkX, chunkZ).solids.trees,
      )
      expect(trees.length).toBeGreaterThan(0)
      expect(trees.every((tree) => tree.kind === kind)).toBe(true)
    },
  )
})

describe('placeChunkSolids — tamanho por bioma', () => {
  // Um bioma do registro com pedra; o mesmo mundo com e sem `scale`.
  const biome = listBiomes().find(({ vegetation }) =>
    vegetation.some(({ kind }) => kind === ROCK_KIND),
  )
  const withScale = (scale) =>
    worldOf([biome.id], (recipe) => {
      const entry = recipe.biomeList[0].vegetation.find(
        ({ kind }) => kind === ROCK_KIND,
      )
      entry.scale = scale
    })
  const area = Array.from({ length: 16 }, (_, i) => [i % 4, Math.floor(i / 4)])
  const rocksOf = (recipe) =>
    area.flatMap(([chunkX, chunkZ]) => {
      const { chunk, solids } = solidsOf(recipe, 17, chunkX, chunkZ)
      return solids.rocks.map((rock) => ({ rock, chunk, solids }))
    })

  it('o `scale` do bioma multiplica o tamanho sorteado', () => {
    const { SCALE } = GAME_CONFIG.ROCKS
    const bigger = rocksOf(withScale(2))
    expect(bigger.length).toBeGreaterThan(0)
    for (const { rock } of bigger) {
      expect(rock.scale).toBeGreaterThanOrEqual(SCALE[0] * 2 - 1e-6)
      expect(rock.scale).toBeLessThanOrEqual(SCALE[1] * 2 + 1e-6)
    }
  })

  it('a pegada maior continua dentro do chunk e guardada', () => {
    const params = currentTerrainRecipe().solids
    for (const { rock, chunk, solids } of rocksOf(withScale(2))) {
      const [circle] = footprintOf(ROCK_KIND, rock, params)
      expect(circle.radius).toBeCloseTo(params.rocks.RADIUS * rock.scale)
      expect(circle.x - circle.radius).toBeGreaterThan(chunk.minX)
      expect(circle.x + circle.radius).toBeLessThan(chunk.minX + chunk.size)
      expect(circle.z - circle.radius).toBeGreaterThan(chunk.minZ)
      expect(circle.z + circle.radius).toBeLessThan(chunk.minZ + chunk.size)
      expect(solids.footprints).toContainEqual(circle)
    }
  })
})

describe('footprintOf', () => {
  const params = currentTerrainRecipe().solids

  it('tronco caído: círculos de ponta a ponta, na direção do giro', () => {
    const log = { x: 10, z: -4, yaw: 0.7, scale: 4 }
    const circles = footprintOf(LOG_KIND, log, params)
    const ends = [circles[0], circles.at(-1)]
    const length = Math.hypot(ends[0].x - ends[1].x, ends[0].z - ends[1].z)
    expect(length).toBeCloseTo(log.scale)
    // Mesmo sentido do eixo X local girado pelo `yaw` no three.js.
    expect((ends[1].x - ends[0].x) / length).toBeCloseTo(Math.cos(log.yaw))
    expect((ends[1].z - ends[0].z) / length).toBeCloseTo(-Math.sin(log.yaw))
  })
})

describe('placeChunkSolids — bioma sem sólidos', () => {
  const without = listBiomes().find(({ vegetation }) =>
    SOLID_KINDS.every(
      (kind) => !vegetation.some((entry) => entry.kind === kind),
    ),
  )

  it.runIf(without)('nenhum objeto', () => {
    const recipe = worldOf([without.id])
    for (const [chunkX, chunkZ] of CHUNKS) {
      const { solids } = solidsOf(recipe, 2, chunkX, chunkZ)
      expect(solids.trees).toEqual([])
      expect(solids.logs).toEqual([])
      expect(solids.rocks).toEqual([])
      expect(solids.footprints).toEqual([])
    }
  })
})
