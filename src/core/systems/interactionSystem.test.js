import { afterEach, describe, expect, it } from 'vitest'
import { makeWorld, ownedByPlayer } from '@/test/makeWorld'
import { TEST_LEVEL } from '../data/testLevel'
import { listItems } from '../data/items'
import { GAME_CONFIG } from '../gameConfig'
import { carregarChunk, descarregarTodosOsChunks } from '../actions/chunks'
import { createEventQueue, EVENT_TYPES } from '../events'
import {
  ActionState,
  GroundItem,
  InputControlled,
  InteractionTarget,
  Inventory,
  Position,
  SummonedCreature,
} from '../traits'
import { forageSpotsOf } from '../worldItems/worldItems'
import { interactionSystem } from './interactionSystem'
import { worldItemsStreamingSystem } from './worldItemsStreamingSystem'

const { INTERACT_RADIUS } = GAME_CONFIG.WORLD_ITEMS
const BALL = listItems().find((item) => item.category === 'pokeball').id
// Longe de qualquer chunk carregado (nada de vegetação por perto).
const FAR = { x: 5000, y: 0, z: 5000 }

const worlds = []
afterEach(() => {
  while (worlds.length) worlds.pop().destroy()
  descarregarTodosOsChunks()
})

function setup(playerPosition = FAR) {
  const made = makeWorld({ playerPosition })
  worlds.push(made.world)
  const { world } = made
  const events = createEventQueue()
  const tick = (input = {}) =>
    interactionSystem({ world, events, input, delta: 1 / 60 })
  return { ...made, events, tick }
}

const groundItem = (world, dx) =>
  world.spawn(
    GroundItem({ worldId: `teste:${dx}`, itemId: BALL, chunkKey: 'teste' }),
    Position({ x: FAR.x + dx, y: 0, z: FAR.z }),
  )

const targetOf = (world) => world.get(InteractionTarget)

describe('interactionSystem — itens do chão', () => {
  it('guarda o mais perto ao alcance', () => {
    const { world, tick } = setup()
    groundItem(world, INTERACT_RADIUS * 0.8)
    groundItem(world, INTERACT_RADIUS * 0.3)

    tick()

    expect(targetOf(world)).toMatchObject({
      kind: 'item',
      worldId: `teste:${INTERACT_RADIUS * 0.3}`,
      itemId: BALL,
    })
  })

  it('fora do alcance, sem alvo nem pega', () => {
    const { world, player, tick } = setup()
    const item = groundItem(world, INTERACT_RADIUS * 1.5)

    tick({ interact: true })

    expect(targetOf(world).kind).toBe(null)
    expect(item.isAlive()).toBe(true)
    expect(player.get(Inventory).counts[BALL] ?? 0).toBe(0)
  })

  it('F pega o item', () => {
    const { world, player, tick } = setup()
    player.set(Inventory, { counts: {}, positions: {} })
    const item = groundItem(world, INTERACT_RADIUS * 0.5)

    tick({ interact: true })

    expect(item.isAlive()).toBe(false)
    expect(player.get(Inventory).counts[BALL]).toBe(1)
  })

  it('no meio de uma ação, mostra mas não pega', () => {
    const { world, player, tick } = setup()
    player.set(ActionState, { ...player.get(ActionState), current: 'throw' })
    const item = groundItem(world, INTERACT_RADIUS * 0.5)

    tick({ interact: true })

    expect(targetOf(world).kind).toBe('item')
    expect(item.isAlive()).toBe(true)
  })

  it('pilotando uma criatura, sem alvo nem pega', () => {
    const { world, player, tick } = setup()
    player.remove(InputControlled)
    world.spawn(
      SummonedCreature({ slot: 'slot1', speciesId: 'bulbasaur' }),
      ...ownedByPlayer(world),
      Position(FAR),
      InputControlled,
    )
    const item = groundItem(world, INTERACT_RADIUS * 0.5)

    tick({ interact: true })

    expect(targetOf(world).kind).toBe(null)
    expect(item.isAlive()).toBe(true)
  })

  it('o alvo que saiu do alcance some', () => {
    const { world, player, tick } = setup()
    groundItem(world, INTERACT_RADIUS * 0.5)
    tick()
    expect(targetOf(world).kind).toBe('item')

    player.set(Position, { ...FAR, x: FAR.x + INTERACT_RADIUS * 3 })
    tick()

    expect(targetOf(world).kind).toBe(null)
  })
})

describe('interactionSystem — vegetação', () => {
  // Um arbusto ou árvore (`source`) de um chunk carregado do jogo.
  function spotOf(source) {
    for (let chunkX = 2; chunkX <= 14; chunkX++) {
      carregarChunk(chunkX, 4)
      const chunk = TEST_LEVEL.terrain
        .loadedChunks()
        .find((c) => c.chunkX === chunkX && c.chunkZ === 4)
      const spot = forageSpotsOf(chunk).find((s) => s.source === source)
      if (spot) return spot
    }
    throw new Error(`nenhum ${source}`)
  }

  it.each(['bush', 'tree'])(
    'ao lado de um %s, o alvo é ele — sem dizer se tem fruta',
    (source) => {
      const spot = spotOf(source)
      const { world, tick } = setup({ x: spot.x + spot.reach, y: 0, z: spot.z })
      worldItemsStreamingSystem({ world })

      tick()

      const target = targetOf(world)
      expect(['bush', 'tree']).toContain(target.kind)
      expect(target.itemId).toBe('')
    },
  )

  it('F vasculha: acha fruta ou avisa que não achou nada', () => {
    const spot = spotOf('tree')
    const { world, events, tick } = setup({
      x: spot.x + spot.reach,
      y: 0,
      z: spot.z,
    })
    worldItemsStreamingSystem({ world })

    tick({ interact: true })

    const types = events.drain().map(({ type }) => type)
    expect(
      types.includes(EVENT_TYPES.BERRIES_HARVESTED) ||
        types.includes(EVENT_TYPES.FORAGED_NOTHING),
    ).toBe(true)
  })
})
