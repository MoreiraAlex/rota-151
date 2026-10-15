import { describe, expect, it } from 'vitest'
import { listBiomes } from '../data/biomes'
import { getItem } from '../data/items'
import { GAME_CONFIG } from '../gameConfig'
import { createRng } from '../rng'
import { createTerrainChunkSet } from '../terrain/terrainChunkSet'
import {
  copyTerrainRecipe,
  currentTerrainRecipe,
} from '../terrain/terrainHeight'
import {
  chunkItemRulesOf,
  findFreeSpot,
  forageBiomeOf,
  forageId,
  forageRulesOf,
  forageSpotsOf,
  refillChecks,
  refillIntervalDays,
  rollChunkItems,
  rollForage,
  rollItemId,
  rollTargetCount,
} from './worldItems'

const SEED = 4242
const { WORLD_ITEMS, TERRAIN } = GAME_CONFIG

// Os biomas que têm itens no chão (os do jogo, com `worldItems`).
const ITEM_BIOMES = listBiomes().filter((biome) => biome.worldItems)

// Mundo só com o bioma `id` (todo chunk é dele).
function chunkSetOf(id, seed = SEED) {
  const recipe = copyTerrainRecipe({
    ...currentTerrainRecipe(),
    biomeList: listBiomes().filter((biome) => biome.id === id),
  })
  return createTerrainChunkSet({ seed, recipe })
}

// Alguns chunks longe da origem (lá não nasce árvore).
const COORDS = [
  [2, 1],
  [-3, 2],
  [4, -2],
]

describe('dados dos itens no mundo', () => {
  it('os biomas visíveis têm itens no chão', () => {
    expect(ITEM_BIOMES.length).toBeGreaterThan(0)
  })

  it('todo item das tabelas existe no catálogo, com peso positivo', () => {
    for (const biome of ITEM_BIOMES) {
      const { table, chance, maxPerChunk, refillMinutes } = biome.worldItems
      expect(chance, biome.id).toBeGreaterThan(0)
      expect(chance, biome.id).toBeLessThanOrEqual(1)
      expect(maxPerChunk, biome.id).toBeGreaterThan(0)
      expect(refillMinutes, biome.id).toBeGreaterThan(0)
      for (const { itemId, weight } of table) {
        expect(getItem(itemId), `${biome.id}: ${itemId}`).toBeTruthy()
        expect(weight, `${biome.id}: ${itemId}`).toBeGreaterThan(0)
      }
    }
  })

  it('no chão, por enquanto, só Pokébolas', () => {
    for (const biome of ITEM_BIOMES) {
      for (const { itemId } of biome.worldItems.table) {
        expect(getItem(itemId)?.category, `${biome.id}: ${itemId}`).toBe(
          'pokeball',
        )
      }
    }
  })

  it('a fruta da vegetação é uma fruta do catálogo, com chance e quantidade', () => {
    const withForage = listBiomes().filter((biome) => biome.forage)
    expect(withForage.length).toBeGreaterThan(0)
    for (const biome of withForage) {
      expect(getItem(biome.forage.itemId)?.category, biome.id).toBe('berry')
      for (const source of ['bush', 'tree']) {
        const rules = biome.forage[source]
        if (!rules) continue
        expect(rules.chance, biome.id).toBeGreaterThan(0)
        expect(rules.chance, biome.id).toBeLessThanOrEqual(1)
        expect(rules.min, biome.id).toBeGreaterThan(0)
        expect(rules.max, biome.id).toBeGreaterThanOrEqual(rules.min)
      }
    }
  })
})

describe('rollTargetCount', () => {
  it('com a chance, de um até o teto; senão, nenhum', () => {
    const rules = { chance: 0.3, maxPerChunk: 3 }
    const rng = createRng(11)
    const counts = Array.from({ length: 2000 }, () =>
      rollTargetCount(rules, rng),
    )
    for (const count of counts) {
      expect(count).toBeGreaterThanOrEqual(0)
      expect(count).toBeLessThanOrEqual(rules.maxPerChunk)
    }
    const share = counts.filter((count) => count > 0).length / counts.length
    expect(share).toBeGreaterThan(rules.chance * 0.8)
    expect(share).toBeLessThan(rules.chance * 1.2)
  })

  it('chance 0, nunca; chance 1, sempre', () => {
    const rng = createRng(12)
    for (let i = 0; i < 50; i++) {
      expect(rollTargetCount({ chance: 0, maxPerChunk: 2 }, rng)).toBe(0)
      expect(
        rollTargetCount({ chance: 1, maxPerChunk: 2 }, rng),
      ).toBeGreaterThan(0)
    }
  })
})

describe('rollItemId', () => {
  it('sempre um item da tabela; peso maior sai mais', () => {
    const table = [
      { itemId: 'a', weight: 9 },
      { itemId: 'b', weight: 1 },
    ]
    const rng = createRng(1)
    const rolls = Array.from({ length: 500 }, () => rollItemId(table, rng))
    expect(rolls.every((id) => id === 'a' || id === 'b')).toBe(true)
    const countOf = (id) => rolls.filter((roll) => roll === id).length
    expect(countOf('a')).toBeGreaterThan(countOf('b'))
  })
})

describe.each(ITEM_BIOMES.map((biome) => biome.id))(
  'rollChunkItems — %s',
  (biomeId) => {
    it('mesma seed e mesmo chunk, mesmos itens', () => {
      const [chunkX, chunkZ] = COORDS[0]
      const a = rollChunkItems(chunkSetOf(biomeId).load(chunkX, chunkZ))
      const b = rollChunkItems(chunkSetOf(biomeId).load(chunkX, chunkZ))
      expect(a).toEqual(b)
    })

    it('até o teto, dentro do chunk, fora da água e longe dos sólidos', () => {
      const set = chunkSetOf(biomeId)
      for (const [chunkX, chunkZ] of COORDS) {
        const chunk = set.load(chunkX, chunkZ)
        const rules = chunkItemRulesOf(chunk)
        const items = rollChunkItems(chunk)
        const itemIds = rules.table.map(({ itemId }) => itemId)

        expect(items.length).toBeLessThanOrEqual(rules.maxPerChunk)
        expect(new Set(items.map(({ id }) => id)).size).toBe(items.length)
        for (const item of items) {
          expect(itemIds).toContain(item.itemId)
          expect(item.x).toBeGreaterThanOrEqual(chunk.minX)
          expect(item.x).toBeLessThan(chunk.minX + chunk.size)
          expect(item.z).toBeGreaterThanOrEqual(chunk.minZ)
          expect(item.z).toBeLessThan(chunk.minZ + chunk.size)
          expect(item.y).toBeGreaterThanOrEqual(TERRAIN.WATER_LEVEL)
          for (const circle of chunk.solids.footprints) {
            expect(
              Math.hypot(circle.x - item.x, circle.z - item.z),
            ).toBeGreaterThanOrEqual(circle.radius)
          }
        }
      }
    })

    it('de nenhum até o teto: há chunk vazio e chunk com item', () => {
      const set = chunkSetOf(biomeId)
      const counts = []
      for (let chunkX = -6; chunkX <= 6; chunkX++) {
        for (let chunkZ = 2; chunkZ <= 5; chunkZ++) {
          const chunk = set.load(chunkX, chunkZ)
          counts.push(rollChunkItems(chunk).length)
        }
      }
      expect(counts).toContain(0)
      expect(counts.some((count) => count > 0)).toBe(true)
    })

    it('chunks diferentes, ids diferentes', () => {
      const set = chunkSetOf(biomeId)
      const ids = COORDS.flatMap(([chunkX, chunkZ]) =>
        rollChunkItems(set.load(chunkX, chunkZ)).map(({ id }) => id),
      )
      expect(new Set(ids).size).toBe(ids.length)
    })
  },
)

describe('rollChunkItems — bioma sem itens', () => {
  it('não dá nada', () => {
    const biome = listBiomes().find((candidate) => !candidate.worldItems)
    const chunk = chunkSetOf(biome.id).load(...COORDS[0])
    expect(rollChunkItems(chunk)).toEqual([])
  })
})

describe('findFreeSpot', () => {
  it('fica longe de quem deve evitar e dos outros itens', () => {
    const set = chunkSetOf(ITEM_BIOMES[0].id)
    const chunk = set.load(...COORDS[0])
    const avoid = {
      x: chunk.minX + chunk.size / 2,
      z: chunk.minZ + chunk.size / 2,
    }
    const minDistance = chunk.size / 4
    const rng = createRng(7)
    const items = []
    for (let i = 0; i < 5; i++) {
      const spot = findFreeSpot(chunk, { rng, items, avoid, minDistance })
      if (!spot) continue
      expect(
        Math.hypot(spot.x - avoid.x, spot.z - avoid.z),
      ).toBeGreaterThanOrEqual(minDistance)
      for (const item of items) {
        expect(
          Math.hypot(spot.x - item.x, spot.z - item.z),
        ).toBeGreaterThanOrEqual(WORLD_ITEMS.ITEM_SPACING)
      }
      items.push(spot)
    }
  })
})

describe('refillChecks', () => {
  const rules = ITEM_BIOMES[0].worldItems
  const interval = refillIntervalDays(rules)

  it('uma verificação por intervalo; antes do primeiro, nenhuma', () => {
    expect(refillChecks(interval * 0.99, rules)).toBe(0)
    expect(refillChecks(interval * 2.5, rules)).toBe(2)
    expect(refillChecks(0, rules)).toBe(0)
    expect(refillChecks(-1, rules)).toBe(0)
  })
})

describe('vasculhar a vegetação', () => {
  const biome = listBiomes().find((candidate) => candidate.forage)

  function chunkWithBoth() {
    const set = chunkSetOf(biome.id)
    for (let chunkX = -8; chunkX <= 8; chunkX++) {
      for (let chunkZ = -8; chunkZ <= 8; chunkZ++) {
        const chunk = set.load(chunkX, chunkZ)
        const { bushes, solids } = chunk
        if (bushes.length > 0 && solids.trees.length > 0) return chunk
      }
    }
    throw new Error('nenhum chunk com arbusto e árvore')
  }

  it('todo arbusto e toda árvore do chunk podem ser vasculhados', () => {
    const chunk = chunkWithBoth()
    const spots = forageSpotsOf(chunk)
    expect(spots.filter(({ source }) => source === 'bush')).toHaveLength(
      chunk.bushes.length,
    )
    expect(spots.filter(({ source }) => source === 'tree')).toHaveLength(
      chunk.solids.trees.length,
    )
    expect(new Set(spots.map(({ id }) => id)).size).toBe(spots.length)
    for (const spot of spots) expect(spot.reach).toBeGreaterThan(0)
  })

  it('o id sai da posição: o mesmo lugar, o mesmo id', () => {
    const spot = { x: 1.234, z: -5.678 }
    expect(forageId('bush', { ...spot })).toBe(forageId('bush', spot))
    expect(forageId('bush', spot)).not.toBe(forageId('tree', spot))
    expect(forageId('bush', { ...spot, x: 2 })).not.toBe(forageId('bush', spot))
  })

  it('a fruta é a do bioma do lugar', () => {
    const chunk = chunkWithBoth()
    for (const spot of forageSpotsOf(chunk).slice(0, 10)) {
      const rules = forageRulesOf(forageBiomeOf(chunk, spot), spot.source)
      expect(rules?.itemId).toBe(biome.forage.itemId)
    }
  })

  it('o sorteio do dia é fixo, entre min e max, e muda com os dias', () => {
    const rules = forageRulesOf(biome.id, 'tree')
    const amounts = Array.from({ length: 200 }, (_, day) =>
      rollForage(SEED, 'tree:1.00,2.00', day, rules),
    )
    for (const amount of amounts) {
      if (amount === 0) continue
      expect(amount).toBeGreaterThanOrEqual(rules.min)
      expect(amount).toBeLessThanOrEqual(rules.max)
    }
    expect(amounts.some((amount) => amount > 0)).toBe(true)
    expect(amounts.some((amount) => amount === 0)).toBe(true)
    expect(rollForage(SEED, 'tree:1.00,2.00', 7, rules)).toBe(amounts[7])
  })

  it('sem regra (bioma sem fruta), nada', () => {
    expect(rollForage(SEED, 'bush:0.00,0.00', 0, null)).toBe(0)
  })
})
