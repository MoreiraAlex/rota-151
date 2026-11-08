import { afterEach, describe, expect, it } from 'vitest'
import { makeWorld } from '@/test/makeWorld'
import { spawnWild } from '@/test/spawnWild'
import { desmaiar } from '../actions/faint'
import { createEventQueue, EVENT_TYPES } from '../events'
import { GAME_CONFIG } from '../gameConfig'
import {
  BeingCaptured,
  OrbitCamera,
  WildSpawnInfo,
  WildSpawnState,
} from '../traits'
import { spawnParams } from '../wildSpawn/wildSpawn'
import { wildDespawnSystem } from './wildDespawnSystem'

// Despawn das selvagens que ficaram para trás (docs/features/062-spawn-
// estilo-cobblemon.md): as três faixas de distância do jogador, a idade e
// a vista da câmera.

const params = spawnParams()
const { DESPAWN_CHECK_INTERVAL } = GAME_CONFIG.WILD_SPAWN

const worlds = []
afterEach(() => {
  while (worlds.length) worlds.pop().destroy()
})

function setup() {
  const made = makeWorld({ playerPosition: { x: 0, y: 0, z: 0 } })
  worlds.push(made.world)
  return { ...made, events: createEventQueue() }
}

describe('wildDespawnSystem', () => {
  const check = (world, events) =>
    wildDespawnSystem({ world, delta: DESPAWN_CHECK_INTERVAL, events })

  it('a idade anda a cada passo', () => {
    const { world, events } = setup()
    const wild = spawnWild(world, { at: { x: 0, y: 0, z: 1 } })
    wild.add(WildSpawnInfo)

    check(world, events)

    expect(wild.get(WildSpawnInfo).age).toBe(DESPAWN_CHECK_INTERVAL)
  })

  it('longe some e avisa; perto fica, mesmo velha', () => {
    const { world, events } = setup()
    const farAway = spawnWild(world, {
      at: { x: 0, y: 0, z: params.FAR_RADIUS * 2 },
    })
    farAway.add(WildSpawnInfo)
    const close = spawnWild(world, {
      at: { x: 0, y: 0, z: params.NEAR_RADIUS / 2 },
    })
    close.add(WildSpawnInfo({ age: params.MAX_AGE }))

    check(world, events)

    expect(farAway.isAlive()).toBe(false)
    expect(close.isAlive()).toBe(true)
    const despawned = events
      .drain()
      .filter((event) => event.type === EVENT_TYPES.WILD_DESPAWNED)
    expect(despawned.map((event) => event.reason)).toEqual(['far'])
  })

  it('no meio, a velha fora da vista some; a nova fica', () => {
    const { world, events } = setup()
    const mid = (params.NEAR_RADIUS + params.FAR_RADIUS) / 2
    // Atrás da câmera (ela olha para -z com yaw 0; aqui, com o yaw dela).
    const yaw = world.queryFirst(OrbitCamera).get(OrbitCamera).yaw
    const behind = { x: Math.sin(yaw) * mid, y: 0, z: Math.cos(yaw) * mid }
    const old = spawnWild(world, { at: behind })
    old.add(WildSpawnInfo({ age: params.MAX_AGE }))
    const young = spawnWild(world, { at: behind })
    young.add(WildSpawnInfo)

    check(world, events)

    expect(old.isAlive()).toBe(false)
    expect(young.isAlive()).toBe(true)
  })

  it('dentro da Pokébola nunca some; desmaiada segue as faixas', () => {
    const { world, events } = setup()
    const at = { x: 0, y: 0, z: params.FAR_RADIUS * 2 }
    const captured = spawnWild(world, { at })
    captured.add(WildSpawnInfo, BeingCaptured)
    const fainted = spawnWild(world, { at })
    fainted.add(WildSpawnInfo)
    desmaiar(world, fainted)

    check(world, events)

    expect(captured.isAlive()).toBe(true)
    expect(fainted.isAlive()).toBe(false)
  })

  it('só verifica no intervalo', () => {
    const { world, events } = setup()
    const wild = spawnWild(world, {
      at: { x: 0, y: 0, z: params.FAR_RADIUS * 2 },
    })
    wild.add(WildSpawnInfo)
    world.set(WildSpawnState, { despawnTimer: DESPAWN_CHECK_INTERVAL })

    wildDespawnSystem({ world, delta: DESPAWN_CHECK_INTERVAL / 4, events })

    expect(wild.isAlive()).toBe(true)
  })
})
