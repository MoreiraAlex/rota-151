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
import { vegetationEntryOf } from './vegetationEntry'
import {
  ROCK_KIND,
  STANDING_TREE_KINDS,
  TREE_KIND,
  borderGapOf,
  footprintOf,
  placeChunkSolids,
  solidFootprintOf,
  specOf,
} from './solidPlacement'

const { TERRAIN } = GAME_CONFIG
const GROUPS = ['trees', 'rocks']
const SOLID_KINDS = [...STANDING_TREE_KINDS, ROCK_KIND]

// Se o tipo nasce no bioma (tem `models`).
const hasKind = (biome, kind) => Boolean(vegetationEntryOf(biome, kind))

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

// `size` (m): o lado do pedaço sorteado — o chunk, ou o bloco de sólidos
// (`SOLIDS_BLOCK_SIZE`), como o jogo sorteia (`terrainChunkSet.js`).
function solidsOf(
  recipe,
  seed,
  chunkX,
  chunkZ,
  size = recipe.terrain.CHUNK_SIZE,
) {
  const sampler = createTerrainSampler(seed, recipe)
  const chunk = generateTerrainChunk(sampler, chunkX, chunkZ, {
    ...recipe.terrain,
    CHUNK_SIZE: size,
  })
  const solids = placeChunkSolids(chunk, {
    seed,
    biomeList: recipe.biomeList,
    terrain: recipe.terrain,
    params: recipe.solids,
  })
  return { chunk, solids }
}

// O bioma do registro com árvore e pedra que tem mais árvore.
const treeDensityOf = ({ vegetation }) =>
  vegetation.find(({ kind }) => kind === TREE_KIND)?.density ?? 0
const withAllSolids = listBiomes()
  .filter((biome) =>
    [TREE_KIND, ROCK_KIND].every((kind) => hasKind(biome, kind)),
  )
  .sort((a, b) => treeDensityOf(b) - treeDensityOf(a))[0]

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
        // O tamanho do tipo no bioma (`scale` da entrada) multiplica o
        // sorteado e a folga da borda.
        const biomeScale =
          world.biomeList[0].vegetation.find(({ kind }) => kind === item.kind)
            ?.scale ?? 1
        const gap = borderGapOf(item.kind, params, biomeScale)
        expect(chunkHeightAt(chunk, item.x, item.z)).toBeGreaterThanOrEqual(
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
        expect(item.scale).toBeGreaterThanOrEqual(
          spec.SCALE[0] * biomeScale - 1e-9,
        )
        expect(item.scale).toBeLessThanOrEqual(
          spec.SCALE[1] * biomeScale + 1e-9,
        )
      }
    },
  )

  it('a base inteira fica enterrada, mesmo no barranco (066)', () => {
    const { REACH, SINK } = GAME_CONFIG.SOLID_GROUND
    for (const [chunkX, chunkZ] of CHUNKS) {
      const { chunk, solids } = solidsOf(world, 11, chunkX, chunkZ)
      for (const item of allOf(solids)) {
        const reach = solidFootprintOf(item, params).radius * REACH
        for (let i = 0; i <= 8; i++) {
          const angle = (i / 8) * Math.PI * 2
          const radius = i === 8 ? 0 : reach
          const ground = chunkHeightAt(
            chunk,
            item.x + Math.cos(angle) * radius,
            item.z + Math.sin(angle) * radius,
          )
          expect(item.y).toBeLessThanOrEqual(ground - SINK + 1e-9)
        }
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
  const biomeWith = (kind) => listBiomes().find((biome) => hasKind(biome, kind))

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
          .map(({ kind: only, models }) => ({ kind: only, density: 1, models }))
      })
      // Em blocos de sólidos, como o jogo sorteia (as árvores grandes têm
      // células e troncos maiores que um chunk), numa área de vários.
      const block = GAME_CONFIG.TERRAIN.SOLIDS_BLOCK_SIZE
      const area = Array.from({ length: 9 }, (_, i) => [
        i % 3,
        Math.floor(i / 3),
      ])
      const trees = area.flatMap(
        ([blockX, blockZ]) =>
          solidsOf(world, 21, blockX, blockZ, block).solids.trees,
      )
      expect(trees.length).toBeGreaterThan(0)
      expect(trees.every((tree) => tree.kind === kind)).toBe(true)
    },
  )
})

describe('placeChunkSolids — tamanho por bioma', () => {
  // O bioma do registro com mais pedra (das que nascem: com modelos); o
  // mesmo mundo com e sem `scale`.
  const rockDensityOf = (candidate) => {
    const entry = vegetationEntryOf(candidate, ROCK_KIND)
    return entry?.models?.length ? entry.density : 0
  }
  const biome = [...listBiomes()].sort(
    (a, b) => rockDensityOf(b) - rockDensityOf(a),
  )[0]
  const withScale = (scale) =>
    worldOf([biome.id], (recipe) => {
      const entry = recipe.biomeList[0].vegetation.find(
        ({ kind }) => kind === ROCK_KIND,
      )
      entry.scale = scale
    })
  // Em blocos de sólidos, como o jogo sorteia (`terrainChunkSet.js`). Um
  // `scale` diferente do do bioma que ainda cabe folgado no bloco (a folga
  // da borda até um quarto dele), qualquer que seja o tamanho das pedras no
  // config.
  const params = currentTerrainRecipe().solids
  const { OBSTACLE_MARGIN, CELL_SIZE } = GAME_CONFIG.PATHFINDING
  const block = GAME_CONFIG.TERRAIN.SOLIDS_BLOCK_SIZE
  const reach = params.rocks.RADIUS * params.rocks.SCALE[1]
  const room = block / 4 - OBSTACLE_MARGIN - CELL_SIZE
  const fitting = Math.min(2, room / reach)
  const area = Array.from({ length: 4 }, (_, i) => [i % 2, Math.floor(i / 2)])
  const rocksOf = (recipe) =>
    area.flatMap(([blockX, blockZ]) => {
      const { chunk, solids } = solidsOf(recipe, 17, blockX, blockZ, block)
      return solids.rocks.map((rock) => ({ rock, chunk, solids }))
    })

  it('o `scale` do bioma multiplica o tamanho sorteado', () => {
    const { SCALE } = GAME_CONFIG.ROCKS
    const scaled = rocksOf(withScale(fitting))
    expect(scaled.length).toBeGreaterThan(0)
    for (const { rock } of scaled) {
      expect(rock.scale).toBeGreaterThanOrEqual(SCALE[0] * fitting - 1e-6)
      expect(rock.scale).toBeLessThanOrEqual(SCALE[1] * fitting + 1e-6)
    }
  })

  it('a pegada maior continua dentro do chunk e guardada', () => {
    for (const { rock, chunk, solids } of rocksOf(withScale(fitting))) {
      // A pegada pelo modelo do LGPE (o casco), que cresce com o tamanho.
      const circle = solidFootprintOf(rock, params)
      expect(circle.radius).toBeGreaterThan(0)
      expect(circle.x - circle.radius).toBeGreaterThan(chunk.minX)
      expect(circle.x + circle.radius).toBeLessThan(chunk.minX + chunk.size)
      expect(circle.z - circle.radius).toBeGreaterThan(chunk.minZ)
      expect(circle.z + circle.radius).toBeLessThan(chunk.minZ + chunk.size)
      expect(solids.footprints).toContainEqual(circle)
    }
  })
})

describe('placeChunkSolids — bioma sem sólidos', () => {
  // Sem nenhum sólido que nasça (com `models`) — pode declarar algum sem
  // modelo, que não nasce.
  const without = listBiomes().find((biome) =>
    SOLID_KINDS.every((kind) => !hasKind(biome, kind)),
  )

  it.runIf(without)('nenhum objeto', () => {
    const recipe = worldOf([without.id])
    for (const [chunkX, chunkZ] of CHUNKS) {
      const { solids } = solidsOf(recipe, 2, chunkX, chunkZ)
      expect(solids.trees).toEqual([])
      expect(solids.rocks).toEqual([])
      expect(solids.footprints).toEqual([])
    }
  })
})
