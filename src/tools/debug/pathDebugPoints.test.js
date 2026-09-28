import { afterEach, describe, expect, it } from 'vitest'
import { createWorld } from 'koota'
import { makeWorld } from '@/test/makeWorld'
import { getSpecies } from '@/core/data/species'
import { steerTowards } from '@/core/steering'
import { voltarAVagar } from '@/core/actions/wildBehavior'
import {
  CharacterController,
  InputControlled,
  MovementStats,
  PathState,
  PhysicsBody,
  Position,
  Rotation,
  SummonedCreature,
  Velocity,
  Vitals,
  WanderState,
  WildBehavior,
} from '@/core/traits'
import { creatureFollowSystem } from '@/core/systems/creatureFollowSystem'
import { resolvePathDebugPoints } from './pathDebugPoints'

const POS = { x: 0, y: 1, z: 0 }
const MOVING = { x: 1, y: 0, z: 0 }
const STOPPED = { x: 0, y: 0, z: 0 }

describe('resolvePathDebugPoints', () => {
  it('com waypoints sobrando: da posição até cada um', () => {
    const w1 = { x: 1, y: 0.5, z: 0 }
    const w2 = { x: 2, y: 0.5, z: 1 }
    const path = {
      waypoints: [{}, w1, w2],
      waypointIndex: 1,
      target: { x: 3, z: 3 },
    }

    expect(resolvePathDebugPoints(POS, path, MOVING)).toEqual([POS, w1, w2])
  })

  it('sem waypoint sobrando: reto até o destino gravado (não até o jogador)', () => {
    const path = { waypoints: [], waypointIndex: 0, target: { x: 5, z: -2 } }

    expect(resolvePathDebugPoints(POS, path, MOVING)).toEqual([
      POS,
      { x: 5, y: POS.y, z: -2 },
    ])
  })

  it('parado ou sem destino: nada', () => {
    const path = {
      waypoints: [{ x: 1, y: 0, z: 0 }],
      waypointIndex: 0,
      target: { x: 5, z: 0 },
    }

    expect(resolvePathDebugPoints(POS, path, STOPPED)).toEqual([])
    expect(
      resolvePathDebugPoints(POS, { ...path, target: null }, MOVING),
    ).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// Quem navega grava o destino que está usando (`PathState.target`).

const worlds = []
afterEach(() => {
  while (worlds.length) worlds.pop().destroy()
})

const FOX = getSpecies('fox')

function spawnNavigator(world, at) {
  return world.spawn(
    Position(at),
    Rotation,
    Velocity,
    MovementStats(FOX.movement),
    CharacterController(FOX.body),
    PhysicsBody,
    PathState,
    WanderState,
    Vitals,
  )
}

describe('PathState.target', () => {
  it('steerTowards (vagar/perseguir/fugir) grava o destino pedido', () => {
    const world = createWorld()
    worlds.push(world)
    const entity = spawnNavigator(world, { x: 30, y: 0.5, z: 30 })
    const moving = {
      pos: entity.get(Position),
      rot: entity.get(Rotation),
      vel: entity.get(Velocity),
      stats: entity.get(MovementStats),
    }

    steerTowards(entity, moving, { x: 33, z: 31 }, 2, 1 / 60)

    expect(entity.get(PathState).target).toEqual({ x: 33, z: 31 })
  })

  it('trocar de estado (voltar a vagar) zera o destino', () => {
    const world = createWorld()
    worlds.push(world)
    const entity = spawnNavigator(world, { x: 30, y: 0.5, z: 30 })
    entity.add(WildBehavior({ state: 'chase' }))
    entity.set(PathState, { ...entity.get(PathState), target: { x: 1, z: 1 } })

    voltarAVagar(entity, entity.get(Position))

    expect(entity.get(PathState).target).toBe(null)
  })

  it('a criatura do time seguindo grava quem está no controle como destino', () => {
    const { world, player } = makeWorld({
      playerPosition: { x: 0, y: 0.5, z: 0 },
    })
    worlds.push(world)
    expect(player.has(InputControlled)).toBe(true)
    const creature = spawnNavigator(world, { x: 20, y: 0.5, z: 0 })
    creature.add(SummonedCreature({ slot: 'slot1', speciesId: 'fox' }))

    creatureFollowSystem({ world, delta: 1 / 60 })

    const { x, z } = player.get(Position)
    expect(creature.get(PathState).target).toEqual({ x, z })
  })
})
