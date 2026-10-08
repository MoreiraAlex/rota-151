import { afterEach, describe, expect, it } from 'vitest'
import { createWorld } from 'koota'
import { GAME_CONFIG } from '../gameConfig'
import { carregarChunk, descarregarTodosOsChunks } from '../actions/chunks'
import { BallOnGround, DroppedFood, Position, Projectile } from '../traits'
import { chunkObjectCleanupSystem } from './chunkObjectCleanupSystem'

const worlds = []

afterEach(() => {
  descarregarTodosOsChunks()
  while (worlds.length) worlds.pop().destroy()
})

const far = GAME_CONFIG.TERRAIN.CHUNK_SIZE * 3

function setup() {
  const world = createWorld()
  worlds.push(world)
  carregarChunk(0, 0)
  const spawnAll = (x) => [
    world.spawn(DroppedFood, Position({ x, y: 0, z: 0 })),
    world.spawn(Projectile, Position({ x, y: 0, z: 0 })),
    world.spawn(BallOnGround({ x, y: 0, z: 0 })),
  ]
  return { world, near: spawnAll(0), away: spawnAll(far) }
}

const tick = (world) => chunkObjectCleanupSystem({ world, delta: 1 / 60 })

describe('chunkObjectCleanupSystem', () => {
  it('objeto solto em chunk descarregado some; no carregado fica', () => {
    const { world, near, away } = setup()

    tick(world)

    for (const entity of away) expect(entity.isAlive()).toBe(false)
    for (const entity of near) expect(entity.isAlive()).toBe(true)
  })

  it('não volta quando o chunk carrega de novo', () => {
    const { world, away } = setup()
    tick(world)

    carregarChunk(3, 0)
    tick(world)

    expect(world.query(DroppedFood)).toHaveLength(1)
    for (const entity of away) expect(entity.isAlive()).toBe(false)
  })
})
