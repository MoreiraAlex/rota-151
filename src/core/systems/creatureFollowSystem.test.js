import { describe, it, expect } from 'vitest'
import { createWorld } from 'koota'
import { makeWorld } from '@/test/makeWorld'
import { Position, SummonedCreature } from '@/core/traits'
import { GAME_CONFIG } from '@/core/gameConfig'
import { creatureFollowSystem } from './creatureFollowSystem'

const { FOLLOW_MIN_DISTANCE } = GAME_CONFIG.PARTY

function tick(world, delta = 1 / 60) {
  creatureFollowSystem({ world, delta })
}

describe('creatureFollowSystem', () => {
  it('anda em direção ao treinador quando longe', () => {
    const { world } = makeWorld({
      playerPosition: { x: 0, y: 1, z: 0 },
    })
    const creature = world.spawn(
      Position({ x: 10, y: 1, z: 0 }),
      SummonedCreature({ slot: 'slot1' }),
    )

    tick(world, 1)

    const pos = creature.get(Position)
    expect(pos.x).toBeLessThan(10)
    expect(pos.x).toBeGreaterThan(FOLLOW_MIN_DISTANCE)
  })

  it('para ao chegar em FOLLOW_MIN_DISTANCE, sem ultrapassar o treinador', () => {
    const { world } = makeWorld({
      playerPosition: { x: 0, y: 1, z: 0 },
    })
    const creature = world.spawn(
      Position({ x: FOLLOW_MIN_DISTANCE + 0.01, y: 1, z: 0 }),
      SummonedCreature({ slot: 'slot1' }),
    )

    tick(world, 1) // delta grande — sem clamp, passaria do treinador

    expect(creature.get(Position).x).toBeCloseTo(FOLLOW_MIN_DISTANCE)
  })

  it('já dentro de FOLLOW_MIN_DISTANCE, não se move', () => {
    const { world } = makeWorld({
      playerPosition: { x: 0, y: 1, z: 0 },
    })
    const creature = world.spawn(
      Position({ x: FOLLOW_MIN_DISTANCE - 0.5, y: 1, z: 0 }),
      SummonedCreature({ slot: 'slot1' }),
    )

    tick(world, 1)

    expect(creature.get(Position).x).toBeCloseTo(FOLLOW_MIN_DISTANCE - 0.5)
  })

  it('sem jogador no world (nenhum InputControlled), não quebra', () => {
    const world = createWorld()
    world.spawn(
      Position({ x: 10, y: 1, z: 0 }),
      SummonedCreature({ slot: 'slot1' }),
    )

    expect(() => tick(world, 1)).not.toThrow()

    world.destroy()
  })
})
