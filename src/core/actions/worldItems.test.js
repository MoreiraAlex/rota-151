import { afterEach, describe, expect, it } from 'vitest'
import { makeWorld } from '@/test/makeWorld'
import { withTestWorldItemRules } from '@/test/worldItemRules'
import { listBiomes } from '../data/biomes'
import { GAME_CONFIG } from '../gameConfig'
import { createEventQueue, EVENT_TYPES } from '../events'
import { createTerrainChunkSet } from '../terrain/terrainChunkSet'
import { chunkKey } from '../terrain/terrainChunk'
import {
  copyTerrainRecipe,
  currentTerrainRecipe,
} from '../terrain/terrainHeight'
import {
  GroundItem,
  Inventory,
  WorldItemChunks,
  WorldItemsMemory,
} from '../traits'
import {
  chunkItemRulesOf,
  forageBiomeOf,
  forageRulesOf,
  forageSpotsOf,
  refillIntervalDays,
  rollChunkItems,
  rollForage,
} from '../worldItems/worldItems'
import { adicionarItem, resolveInventoryCapacity } from './inventory'
import {
  carregarItensDoChunk,
  descarregarItensDoChunk,
  itensDoChunk,
  pegarItemDoMundo,
  reporTempoFora,
  vasculhar,
  verificarTetoDoChunk,
} from './worldItems'
import { createRng } from '../rng'

const SEED = 777
const ITEM_BIOME = listBiomes().find(
  (biome) => biome.worldItems && biome.forage,
)

withTestWorldItemRules()

const worlds = []
afterEach(() => {
  while (worlds.length) worlds.pop().destroy()
})

function setup() {
  const made = makeWorld()
  worlds.push(made.world)
  return { ...made, events: createEventQueue() }
}

// Mundo só com o bioma dos itens.
function chunkSet() {
  const recipe = copyTerrainRecipe({
    ...currentTerrainRecipe(),
    biomeList: [ITEM_BIOME],
  })
  return createTerrainChunkSet({ seed: SEED, recipe })
}

// Um chunk com itens no chão, ou com arbusto e árvore.
function findChunk(test) {
  const set = chunkSet()
  for (let chunkX = -8; chunkX <= 8; chunkX++) {
    for (let chunkZ = -8; chunkZ <= 8; chunkZ++) {
      const chunk = set.load(chunkX, chunkZ)
      if (test(chunk)) return chunk
    }
  }
  throw new Error('nenhum chunk serve')
}
const chunkWithItems = () =>
  findChunk((chunk) => rollChunkItems(chunk).length > 1)
const chunkWithForage = () =>
  findChunk((chunk) => chunk.bushes.length > 0 && chunk.solids.trees.length > 0)

const keyOf = (chunk) => chunkKey(chunk.chunkX, chunk.chunkZ)
const groundItemsOf = (world, key) =>
  world.query(GroundItem).filter((e) => e.get(GroundItem).chunkKey === key)

describe('carregar e descarregar', () => {
  it('chunk sem mexida: as entidades são os itens da seed', () => {
    const { world } = setup()
    const chunk = chunkWithItems()

    carregarItensDoChunk(world, chunk, { now: 0 })

    const ids = groundItemsOf(world, keyOf(chunk))
      .map((e) => e.get(GroundItem).worldId)
      .sort()
    expect(ids).toEqual(
      rollChunkItems(chunk)
        .map(({ id }) => id)
        .sort(),
    )
    expect(world.get(WorldItemChunks).loaded.has(keyOf(chunk))).toBe(true)
  })

  it('carregar duas vezes não duplica', () => {
    const { world } = setup()
    const chunk = chunkWithItems()
    carregarItensDoChunk(world, chunk, { now: 0 })
    const count = world.query(GroundItem).length

    carregarItensDoChunk(world, chunk, { now: 0 })

    expect(world.query(GroundItem).length).toBe(count)
  })

  it('descarregar tira as entidades, mas não a memória', () => {
    const { world, player, events } = setup()
    const chunk = chunkWithItems()
    carregarItensDoChunk(world, chunk, { now: 0 })
    const [first] = groundItemsOf(world, keyOf(chunk))
    pegarItemDoMundo(world, player, first, { chunk, now: 0, events })

    descarregarItensDoChunk(world, keyOf(chunk))

    expect(groundItemsOf(world, keyOf(chunk))).toHaveLength(0)
    expect(world.get(WorldItemsMemory).chunks[keyOf(chunk)]).toBeTruthy()
  })
})

describe('pegarItemDoMundo', () => {
  it('soma no inventário, some do mundo e da memória, e avisa', () => {
    const { world, player, events } = setup()
    const chunk = chunkWithItems()
    carregarItensDoChunk(world, chunk, { now: 0 })
    const [entity] = groundItemsOf(world, keyOf(chunk))
    const { itemId, worldId } = entity.get(GroundItem)
    const before = player.get(Inventory).counts[itemId] ?? 0

    expect(
      pegarItemDoMundo(world, player, entity, { chunk, now: 0, events }),
    ).toBe(true)

    expect(player.get(Inventory).counts[itemId]).toBe(before + 1)
    expect(entity.isAlive()).toBe(false)
    const items = itensDoChunk(world, chunk)
    expect(items.some(({ id }) => id === worldId)).toBe(false)
    expect(events.drain().map(({ type }) => type)).toContain(
      EVENT_TYPES.WORLD_ITEM_PICKED,
    )
  })

  it('pego, não volta ao recarregar o chunk', () => {
    const { world, player, events } = setup()
    const chunk = chunkWithItems()
    carregarItensDoChunk(world, chunk, { now: 0 })
    const [entity] = groundItemsOf(world, keyOf(chunk))
    const { worldId } = entity.get(GroundItem)
    pegarItemDoMundo(world, player, entity, { chunk, now: 0, events })

    descarregarItensDoChunk(world, keyOf(chunk))
    carregarItensDoChunk(world, chunk, { now: 0 })

    const ids = groundItemsOf(world, keyOf(chunk)).map(
      (e) => e.get(GroundItem).worldId,
    )
    expect(ids).not.toContain(worldId)
  })

  it('inventário cheio: não pega, não some, e avisa', () => {
    const { world, player, events } = setup()
    const chunk = chunkWithItems()
    carregarItensDoChunk(world, chunk, { now: 0 })
    const [entity] = groundItemsOf(world, keyOf(chunk))
    const { itemId } = entity.get(GroundItem)
    player.set(Inventory, { counts: {}, positions: {} })
    for (let i = 0; i < resolveInventoryCapacity(); i++) {
      adicionarItem(world, player, `enche-${i}`, 1)
    }

    expect(
      pegarItemDoMundo(world, player, entity, { chunk, now: 0, events }),
    ).toBe(false)

    expect(player.get(Inventory).counts[itemId]).toBeUndefined()
    expect(entity.isAlive()).toBe(true)
    expect(events.drain().map(({ type }) => type)).toContain(
      EVENT_TYPES.INVENTORY_FULL,
    )
  })
})

describe('reposição na volta ao chunk', () => {
  it('repõe o tempo fora, nunca acima do teto', () => {
    const { world, player, events } = setup()
    const chunk = chunkWithItems()
    const rules = chunkItemRulesOf(chunk)
    carregarItensDoChunk(world, chunk, { now: 0 })
    for (const entity of groundItemsOf(world, keyOf(chunk))) {
      pegarItemDoMundo(world, player, entity, { chunk, now: 0, events })
    }
    descarregarItensDoChunk(world, keyOf(chunk))

    const later = refillIntervalDays(rules) * 50
    reporTempoFora(world, chunk, { now: later, rng: createRng(1) })

    const items = itensDoChunk(world, chunk)
    expect(items.length).toBeGreaterThan(0)
    expect(items.length).toBeLessThanOrEqual(rules.maxPerChunk)
  })

  it('voltar antes do intervalo não repõe nada', () => {
    const { world, player, events } = setup()
    const chunk = chunkWithItems()
    const rules = chunkItemRulesOf(chunk)
    carregarItensDoChunk(world, chunk, { now: 0 })
    const [entity] = groundItemsOf(world, keyOf(chunk))
    pegarItemDoMundo(world, player, entity, { chunk, now: 0, events })
    const left = itensDoChunk(world, chunk).length
    descarregarItensDoChunk(world, keyOf(chunk))

    reporTempoFora(world, chunk, { now: refillIntervalDays(rules) * 0.5 })

    expect(itensDoChunk(world, chunk)).toHaveLength(left)
  })

  it('os itens repostos ficam longe de quem deve evitar', () => {
    const { world, player, events } = setup()
    const chunk = chunkWithItems()
    const rules = chunkItemRulesOf(chunk)
    carregarItensDoChunk(world, chunk, { now: 0 })
    for (const entity of groundItemsOf(world, keyOf(chunk))) {
      pegarItemDoMundo(world, player, entity, { chunk, now: 0, events })
    }
    const avoid = {
      x: chunk.minX + chunk.size / 2,
      z: chunk.minZ + chunk.size / 2,
    }

    const added = reporTempoFora(world, chunk, {
      now: refillIntervalDays(rules) * 50,
      avoid,
      rng: createRng(2),
    })

    for (const item of added) {
      expect(
        Math.hypot(item.x - avoid.x, item.z - avoid.z),
      ).toBeGreaterThanOrEqual(GAME_CONFIG.WORLD_ITEMS.SPAWN_MIN_DISTANCE)
    }
  })
})

describe('teto da memória', () => {
  it('se o teto baixou, o que passa dele na memória sai ao carregar', () => {
    const { world, player, events } = setup()
    const chunk = chunkWithItems()
    const rules = chunkItemRulesOf(chunk)
    carregarItensDoChunk(world, chunk, { now: 0 })
    const [first] = groundItemsOf(world, keyOf(chunk))
    pegarItemDoMundo(world, player, first, { chunk, now: 0, events })
    descarregarItensDoChunk(world, keyOf(chunk))
    const entry = world.get(WorldItemsMemory).chunks[keyOf(chunk)]
    const extra = Array.from({ length: rules.maxPerChunk + 3 }, (_, i) => ({
      ...entry.items[0],
      id: `${keyOf(chunk)}:velho${i}`,
    }))
    entry.items = extra

    carregarItensDoChunk(world, chunk, { now: 0 })

    expect(groundItemsOf(world, keyOf(chunk))).toHaveLength(rules.maxPerChunk)
    expect(itensDoChunk(world, chunk).map(({ id }) => id)).toEqual(
      extra.slice(0, rules.maxPerChunk).map(({ id }) => id),
    )
  })
})

describe('verificarTetoDoChunk', () => {
  // Tira alguns itens do chunk e faz verificações com um RNG fixo.
  function afterPicking(take) {
    const made = setup()
    const { world, player, events } = made
    const chunk = chunkWithItems()
    carregarItensDoChunk(world, chunk, { now: 0 })
    for (const entity of groundItemsOf(world, keyOf(chunk)).slice(0, take)) {
      pegarItemDoMundo(world, player, entity, { chunk, now: 0, events })
    }
    return { ...made, chunk, rules: chunkItemRulesOf(chunk) }
  }

  it('nunca tira o que já está no chão nem passa do teto', () => {
    const { world, chunk, rules } = afterPicking(1)
    const rng = createRng(3)
    const before = itensDoChunk(world, chunk).map(({ id }) => id)

    for (let i = 0; i < 30; i++) verificarTetoDoChunk(world, chunk, { rng })

    const after = itensDoChunk(world, chunk).map(({ id }) => id)
    for (const id of before) expect(after).toContain(id)
    expect(after.length).toBeLessThanOrEqual(rules.maxPerChunk)
  })

  it('o sorteio vai de nenhum até o teto: há verificação que não põe nada', () => {
    const { world, chunk } = afterPicking(Infinity)
    const rng = createRng(4)
    const added = []
    for (let i = 0; i < 30; i++) {
      const memory = world.get(WorldItemsMemory).chunks[keyOf(chunk)]
      memory.items = []
      added.push(verificarTetoDoChunk(world, chunk, { rng }).length)
    }
    expect(added).toContain(0)
    expect(added.some((count) => count > 0)).toBe(true)
  })

  it('chunk que ninguém mexeu só entra na memória se ganhar item', () => {
    const { world } = setup()
    const chunk = findChunk((c) => rollChunkItems(c).length === 0)
    carregarItensDoChunk(world, chunk, { now: 0 })
    const rng = createRng(5)

    let added = []
    while (added.length === 0) {
      expect(world.get(WorldItemsMemory).chunks[keyOf(chunk)]).toBeUndefined()
      added = verificarTetoDoChunk(world, chunk, { rng })
    }

    expect(world.get(WorldItemsMemory).chunks[keyOf(chunk)].items).toHaveLength(
      added.length,
    )
  })
})

describe('vasculhar', () => {
  // Um lugar e um dia em que o sorteio dá fruta (e um em que não dá).
  function forageCase(wantFruit) {
    const chunk = chunkWithForage()
    for (const spot of forageSpotsOf(chunk)) {
      const rules = forageRulesOf(forageBiomeOf(chunk, spot), spot.source)
      for (let day = 0; day < 30; day++) {
        const amount = rollForage(chunk.vegetationSeed, spot.id, day, rules)
        if (amount > 0 === wantFruit) return { chunk, spot, rules, day, amount }
      }
    }
    throw new Error('nenhum caso')
  }

  it('com fruta no dia: soma no inventário e avisa', () => {
    const { world, player, events } = setup()
    const { chunk, spot, rules, day, amount } = forageCase(true)
    const before = player.get(Inventory).counts[rules.itemId] ?? 0

    expect(
      vasculhar(world, player, spot, { chunk, now: day + 0.5, events }),
    ).toBe(amount)

    expect(player.get(Inventory).counts[rules.itemId]).toBe(before + amount)
    expect(events.drain().map(({ type }) => type)).toContain(
      EVENT_TYPES.BERRIES_HARVESTED,
    )
  })

  it('colhido, não dá mais nada no mesmo dia; no seguinte, sorteia de novo', () => {
    const { world, player, events } = setup()
    const { chunk, spot, rules, day } = forageCase(true)
    vasculhar(world, player, spot, { chunk, now: day + 0.1, events })

    expect(
      vasculhar(world, player, spot, { chunk, now: day + 0.9, events }),
    ).toBe(0)

    const nextDay = rollForage(chunk.vegetationSeed, spot.id, day + 1, rules)
    expect(
      vasculhar(world, player, spot, { chunk, now: day + 1.1, events }),
    ).toBe(nextDay)
  })

  it('sem fruta no dia: não acha nada e avisa', () => {
    const { world, player, events } = setup()
    const { chunk, spot, day } = forageCase(false)
    const before = { ...player.get(Inventory).counts }

    expect(vasculhar(world, player, spot, { chunk, now: day, events })).toBe(0)

    expect(player.get(Inventory).counts).toEqual(before)
    expect(events.drain().map(({ type }) => type)).toContain(
      EVENT_TYPES.FORAGED_NOTHING,
    )
  })

  it('inventário cheio: não colhe e avisa', () => {
    const { world, player, events } = setup()
    const { chunk, spot, rules, day } = forageCase(true)
    player.set(Inventory, { counts: {}, positions: {} })
    for (let i = 0; i < resolveInventoryCapacity(); i++) {
      adicionarItem(world, player, `enche-${i}`, 1)
    }

    expect(vasculhar(world, player, spot, { chunk, now: day, events })).toBe(0)

    expect(player.get(Inventory).counts[rules.itemId]).toBeUndefined()
    expect(world.get(WorldItemsMemory).foraged[spot.id]).toBeUndefined()
    expect(events.drain().map(({ type }) => type)).toContain(
      EVENT_TYPES.INVENTORY_FULL,
    )
  })
})
