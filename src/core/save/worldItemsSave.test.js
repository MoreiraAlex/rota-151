import { afterEach, describe, expect, it } from 'vitest'
import { makeWorld } from '@/test/makeWorld'
import { listItems } from '../data/items'
import {
  GroundItem,
  Position,
  WorldItemChunks,
  WorldItemsMemory,
} from '../traits'
import { worldItemsSaveSchema } from './saveFormat'
import { restoreWorldItems, serializeWorldItems } from './worldItemsSave'

// Os itens do mundo no save (docs/features/055-itens-no-mundo.md). Itens só
// como dado de teste.
const [ITEM] = listItems()

const worlds = []
afterEach(() => {
  while (worlds.length) worlds.pop().destroy()
})

function setup() {
  const { world } = makeWorld()
  worlds.push(world)
  return world
}

function memoryWith(itemId = ITEM.id) {
  return {
    chunks: {
      '3,4': {
        items: [{ id: '3,4:0', itemId, x: 1, y: 2, z: 3 }],
        lastRefill: 0.5,
        nextIndex: 1,
      },
    },
    foraged: { 'tree:1.00,2.00': 3 },
  }
}

describe('serializeWorldItems / restoreWorldItems', () => {
  it('ida e volta, e passa no schema do save', () => {
    const world = setup()
    world.set(WorldItemsMemory, memoryWith())

    const saved = serializeWorldItems(world)
    const target = setup()
    restoreWorldItems(target, saved)

    expect(worldItemsSaveSchema.safeParse(saved).success).toBe(true)
    expect(serializeWorldItems(target)).toEqual(saved)
  })

  it('o save é uma cópia: mexer no mundo depois não muda ele', () => {
    const world = setup()
    world.set(WorldItemsMemory, memoryWith())
    const saved = serializeWorldItems(world)

    world.get(WorldItemsMemory).chunks['3,4'].items.pop()

    expect(saved.chunks['3,4'].items).toHaveLength(1)
  })

  it('item que não existe mais fica de fora', () => {
    const world = setup()
    restoreWorldItems(world, memoryWith('nao-existe'))

    expect(world.get(WorldItemsMemory).chunks['3,4'].items).toHaveLength(0)
  })

  it('as entidades que já tinham nascido saem, para nascer de novo', () => {
    const world = setup()
    world.spawn(
      GroundItem({ worldId: 'x', itemId: ITEM.id, chunkKey: '3,4' }),
      Position,
    )
    world.get(WorldItemChunks).loaded.set('3,4', null)

    restoreWorldItems(world, memoryWith())

    expect(world.query(GroundItem).length).toBe(0)
    expect(world.get(WorldItemChunks).loaded.size).toBe(0)
  })
})
