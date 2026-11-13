import { afterEach, describe, expect, it } from 'vitest'
import { makeWorld } from '@/test/makeWorld'
import { GAME_CONFIG } from '../gameConfig'
import { TEST_LEVEL } from '../data/testLevel'
import { descarregarTodosOsChunks } from '../actions/chunks'
import { chunkCoordAt } from '../terrain/terrainChunk'
import { GraphicsSettings, InputControlled, Position } from '../traits'
import { chunkStreamingSystem } from './chunkStreamingSystem'

const TERRAIN = GAME_CONFIG.TERRAIN
const VIEW = GAME_CONFIG.GRAPHICS.VIEW_DISTANCE
// O raio de carregar e o de descarregar na distância de visão padrão.
const LOAD = VIEW.DEFAULT
const UNLOAD = VIEW.DEFAULT + TERRAIN.UNLOAD_MARGIN
const worlds = []

afterEach(() => {
  descarregarTodosOsChunks()
  while (worlds.length) worlds.pop().destroy()
})

function setup(position = { x: 0, y: 2, z: 0 }) {
  const made = makeWorld({ playerPosition: position })
  worlds.push(made.world)
  return made
}

const tick = (world) => chunkStreamingSystem({ world, delta: 1 / 60 })
const loadedCount = () => TEST_LEVEL.terrain.loadedChunks().length
const side = (radius) => 2 * radius + 1

// Gera chunks de verdade (relevo, vegetação, sólidos): cada caso leva perto
// de um segundo sozinho e passa do tempo padrão com a suíte inteira em
// paralelo — o tempo próprio é maior.
const SLOW_TIMEOUT = 30_000

describe('chunkStreamingSystem', { timeout: SLOW_TIMEOUT }, () => {
  it('no primeiro tick, o chão em volta do treinador carrega na hora', () => {
    const { world } = setup()
    tick(world)
    expect(loadedCount()).toBe(
      side(TERRAIN.NEAR_RADIUS) ** 2 + TERRAIN.CHUNKS_PER_TICK,
    )
    expect(TEST_LEVEL.terrain.isLoadedAt(0, 0)).toBe(true)
  })

  it('o resto entra aos poucos, até cobrir o raio de carregar', () => {
    const { world } = setup()
    const wanted = side(LOAD) ** 2
    for (let i = 0; i < wanted; i++) tick(world)
    expect(loadedCount()).toBe(wanted)
    expect(TEST_LEVEL.terrain.streamingStatus().pending).toEqual([])
  })

  it('andando para longe, os chunks de trás descarregam', () => {
    const { world, player } = setup()
    for (let i = 0; i < side(LOAD) ** 2; i++) tick(world)

    const far = TERRAIN.CHUNK_SIZE * (UNLOAD + 3)
    player.set(Position, { x: far, y: 2, z: 0 })
    tick(world)

    expect(TEST_LEVEL.terrain.isLoaded(0, 0)).toBe(false)
    expect(TEST_LEVEL.terrain.isLoadedAt(far, 0)).toBe(true)
  })

  it('a criatura controlada também é centro', () => {
    const { world, player } = setup()
    const far = TERRAIN.CHUNK_SIZE * (UNLOAD + 3)
    // Pilotada longe do treinador (como depois da troca de controle).
    player.remove(InputControlled)
    world.spawn(Position({ x: -far, y: 2, z: 0 }), InputControlled)

    tick(world)

    expect(TEST_LEVEL.terrain.isLoadedAt(0, 0)).toBe(true)
    expect(TEST_LEVEL.terrain.isLoadedAt(-far, 0)).toBe(true)
    expect(
      TEST_LEVEL.terrain.isLoaded(
        chunkCoordAt(-far / 2, TERRAIN.CHUNK_SIZE),
        0,
      ),
    ).toBe(false)
  })

  it('parado com tudo carregado, os ticks seguintes não mudam nada', () => {
    const { world } = setup()
    for (let i = 0; i < side(LOAD) ** 2; i++) tick(world)
    const revision = TEST_LEVEL.terrain.getRevision()

    tick(world)
    tick(world)

    expect(TEST_LEVEL.terrain.getRevision()).toBe(revision)
    expect(loadedCount()).toBe(side(LOAD) ** 2)
  })

  it('parado, volta a carregar se o terreno muda por fora', () => {
    const { world } = setup()
    for (let i = 0; i < side(LOAD) ** 2; i++) tick(world)

    descarregarTodosOsChunks()
    tick(world)

    expect(TEST_LEVEL.terrain.isLoadedAt(0, 0)).toBe(true)
  })

  it('andando dentro do mesmo chunk, nada muda; ao trocar de chunk, planeja de novo', () => {
    const { world, player } = setup({ x: 1, y: 2, z: 1 })
    for (let i = 0; i < side(LOAD) ** 2; i++) tick(world)
    const revision = TEST_LEVEL.terrain.getRevision()

    player.set(Position, { x: 2, y: 2, z: 2 })
    tick(world)
    expect(TEST_LEVEL.terrain.getRevision()).toBe(revision)

    player.set(Position, { x: 1 + TERRAIN.CHUNK_SIZE, y: 2, z: 1 })
    tick(world)
    const edge = TERRAIN.CHUNK_SIZE * (LOAD + 1) + 1
    expect(TEST_LEVEL.terrain.isLoadedAt(edge, 1)).toBe(true)
  })

  it('carrega até a distância de visão escolhida no menu', () => {
    const { world, player } = setup()
    const chosen = VIEW.MIN
    player.set(GraphicsSettings, {
      ...player.get(GraphicsSettings),
      viewDistance: chosen,
    })
    for (let i = 0; i < side(VIEW.MAX) ** 2; i++) tick(world)

    expect(loadedCount()).toBe(side(chosen) ** 2)
    expect(TEST_LEVEL.terrain.loadRadius()).toBe(chosen)
  })

  it('aumentando a distância, carrega mais; diminuindo, descarrega o de fora da folga', () => {
    const { world, player } = setup()
    const pick = (viewDistance) =>
      player.set(GraphicsSettings, {
        ...player.get(GraphicsSettings),
        viewDistance,
      })
    pick(VIEW.MAX)
    for (let i = 0; i < side(VIEW.MAX) ** 2; i++) tick(world)
    expect(loadedCount()).toBe(side(VIEW.MAX) ** 2)

    pick(VIEW.MIN)
    tick(world)
    const kept = Math.min(VIEW.MIN + TERRAIN.UNLOAD_MARGIN, VIEW.MAX)
    expect(loadedCount()).toBe(side(kept) ** 2)
    expect(TEST_LEVEL.terrain.loadRadius()).toBe(VIEW.MIN)
  })
})
