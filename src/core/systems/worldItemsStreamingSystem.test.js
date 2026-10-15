import { afterEach, describe, expect, it } from 'vitest'
import { makeWorld } from '@/test/makeWorld'
import { withTestWorldItemRules } from '@/test/worldItemRules'
import { TEST_LEVEL } from '../data/testLevel'
import {
  carregarChunk,
  descarregarChunk,
  descarregarTodosOsChunks,
} from '../actions/chunks'
import { pegarItemDoMundo } from '../actions/worldItems'
import { createEventQueue } from '../events'
import { chunkKey } from '../terrain/terrainChunk'
import {
  GroundItem,
  WorldClock,
  WorldItemChunks,
  WorldItemsMemory,
} from '../traits'
import {
  chunkItemRulesOf,
  refillIntervalDays,
  rollChunkItems,
} from '../worldItems/worldItems'
import { worldItemRefillSystem } from './worldItemRefillSystem'
import { worldItemsStreamingSystem } from './worldItemsStreamingSystem'
import { GAME_CONFIG } from '../gameConfig'

// Um passo do tamanho do intervalo em que a reposição confere os chunks.
const CHECK = GAME_CONFIG.WORLD_ITEMS.REFILL_CHECK_SECONDS

withTestWorldItemRules()

const worlds = []
afterEach(() => {
  while (worlds.length) worlds.pop().destroy()
  descarregarTodosOsChunks()
})

function setup() {
  const made = makeWorld({ playerPosition: { x: 0, y: 0, z: 0 } })
  worlds.push(made.world)
  return made
}

// Faixas do mundo do jogo onde procurar (mais de uma: uma cidade — sem
// itens, docs/features/056-bioma-cidade.md — pode cobrir uma faixa inteira).
const SEARCH_ROWS = [3, -6, 12, -15]

// Um chunk do mundo do jogo com itens no chão (carregado).
function loadChunkWithItems() {
  for (const chunkZ of SEARCH_ROWS) {
    for (let chunkX = 2; chunkX <= 12; chunkX++) {
      carregarChunk(chunkX, chunkZ)
      const chunk = TEST_LEVEL.terrain
        .loadedChunks()
        .find((c) => c.chunkX === chunkX && c.chunkZ === chunkZ)
      if (chunkItemRulesOf(chunk) && rollChunkItems(chunk).length > 1) {
        return chunk
      }
      descarregarChunk(chunkX, chunkZ)
    }
  }
  throw new Error('nenhum chunk com itens')
}

const keyOf = (chunk) => chunkKey(chunk.chunkX, chunk.chunkZ)
const itemsOf = (world, chunk) =>
  world
    .query(GroundItem)
    .filter((e) => e.get(GroundItem).chunkKey === keyOf(chunk))

describe('worldItemsStreamingSystem', () => {
  it('chunk carregado ganha as entidades; descarregado, perde', () => {
    const { world } = setup()
    const chunk = loadChunkWithItems()

    worldItemsStreamingSystem({ world })
    expect(itemsOf(world, chunk).length).toBe(rollChunkItems(chunk).length)
    expect(world.get(WorldItemChunks).loaded.has(keyOf(chunk))).toBe(true)

    descarregarChunk(chunk.chunkX, chunk.chunkZ)
    worldItemsStreamingSystem({ world })
    expect(itemsOf(world, chunk)).toHaveLength(0)
    expect(world.get(WorldItemChunks).loaded.has(keyOf(chunk))).toBe(false)
  })
})

describe('worldItemRefillSystem', () => {
  it('chunk abaixo do teto completa nas verificações, até o teto', () => {
    const { world, player } = setup()
    const chunk = loadChunkWithItems()
    const rules = chunkItemRulesOf(chunk)
    const events = createEventQueue()
    worldItemsStreamingSystem({ world })
    for (const entity of itemsOf(world, chunk)) {
      pegarItemDoMundo(world, player, entity, { chunk, now: 0, events })
    }
    const interval = refillIntervalDays(rules)

    world.set(WorldClock, { ...world.get(WorldClock), time: interval * 0.5 })
    worldItemRefillSystem({ world, delta: CHECK })
    expect(itemsOf(world, chunk)).toHaveLength(0)

    for (let step = 1; step <= 40; step++) {
      world.set(WorldClock, { ...world.get(WorldClock), time: interval * step })
      worldItemRefillSystem({ world, delta: CHECK })
    }
    const count = itemsOf(world, chunk).length
    expect(count).toBeGreaterThan(0)
    expect(count).toBeLessThanOrEqual(rules.maxPerChunk)
    expect(world.get(WorldItemsMemory).chunks[keyOf(chunk)].items).toHaveLength(
      count,
    )
  })

  it('só confere os chunks de tempos em tempos, não a cada passo', () => {
    const { world, player } = setup()
    const chunk = loadChunkWithItems()
    const rules = chunkItemRulesOf(chunk)
    const events = createEventQueue()
    worldItemsStreamingSystem({ world })
    for (const entity of itemsOf(world, chunk)) {
      pegarItemDoMundo(world, player, entity, { chunk, now: 0, events })
    }
    world.set(WorldClock, {
      ...world.get(WorldClock),
      time: refillIntervalDays(rules) * 1000,
    })
    worldItemRefillSystem({ world, delta: CHECK })
    const lastRefill = () =>
      world.get(WorldItemsMemory).chunks[keyOf(chunk)].lastRefill
    const afterFirst = lastRefill()

    worldItemRefillSystem({ world, delta: CHECK * 0.25 })

    expect(lastRefill()).toBe(afterFirst)
  })

  it('chunk que ninguém mexeu também repõe, sem tirar o que tem', () => {
    const { world } = setup()
    const chunk = loadChunkWithItems()
    const rules = chunkItemRulesOf(chunk)
    worldItemsStreamingSystem({ world })
    const before = itemsOf(world, chunk).map((e) => e.get(GroundItem).worldId)
    const interval = refillIntervalDays(rules)

    for (let step = 1; step <= 20; step++) {
      world.set(WorldClock, { ...world.get(WorldClock), time: interval * step })
      worldItemRefillSystem({ world, delta: CHECK })
    }

    const after = itemsOf(world, chunk).map((e) => e.get(GroundItem).worldId)
    for (const id of before) expect(after).toContain(id)
    expect(after.length).toBeLessThanOrEqual(rules.maxPerChunk)
  })
})
