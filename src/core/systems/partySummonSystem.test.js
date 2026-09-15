import { describe, it, expect } from 'vitest'
import { makeWorld } from '@/test/makeWorld'
import {
  AnimationState,
  Party,
  Position,
  Rotation,
  SummonedCreature,
} from '@/core/traits'
import { partySummonSystem } from './partySummonSystem'

function tick(world, input = {}) {
  partySummonSystem({ world, input })
}

describe('partySummonSystem', () => {
  it('slot vazio: apertar o botão não faz nada', () => {
    const { world } = makeWorld()

    tick(world, { secondary1: true })

    expect(world.query(SummonedCreature).length).toBe(0)
  })

  it('slot com criatura: invoca uma entidade marcada com o slot', () => {
    const { world, player } = makeWorld()
    player.set(Party, { slot1: 'fox-red' })

    tick(world, { secondary1: true })

    const summoned = world.query(SummonedCreature)
    expect(summoned).toHaveLength(1)
    expect(summoned[0].get(SummonedCreature).slot).toBe('slot1')
  })

  it('a criatura invocada guarda a espécie e nasce pronta pra ser renderizada', () => {
    const { world, player } = makeWorld()
    player.set(Party, { slot1: 'fox-red' })

    tick(world, { secondary1: true })

    const [creature] = world.query(SummonedCreature, Position, Rotation)
    expect(creature.get(SummonedCreature).speciesId).toBe('fox-red')
    expect(creature.has(AnimationState)).toBe(true)
    expect(creature.get(AnimationState).id).toBe('idle')
  })

  it('invoca perto do treinador', () => {
    const { world, player } = makeWorld({
      playerPosition: { x: 5, y: 1, z: 5 },
    })
    player.set(Party, { slot1: 'fox-red' })

    tick(world, { secondary1: true })

    const [creature] = world.query(SummonedCreature)
    const pos = creature.get(Position)
    expect(Math.hypot(pos.x - 5, pos.z - 5)).toBeGreaterThan(0)
    expect(Math.hypot(pos.x - 5, pos.z - 5)).toBeLessThan(5)
  })

  it('apertar de novo o mesmo slot recolhe (destrói) a criatura', () => {
    const { world, player } = makeWorld()
    player.set(Party, { slot1: 'fox-red' })

    tick(world, { secondary1: true })
    expect(world.query(SummonedCreature).length).toBe(1)

    tick(world, { secondary1: true })
    expect(world.query(SummonedCreature).length).toBe(0)
  })

  it('cada slot é independente — dá pra ter as 3 de fora ao mesmo tempo', () => {
    const { world, player } = makeWorld()
    player.set(Party, {
      slot1: 'fox-red',
      slot2: 'fox-green',
      slot3: 'fox-blue',
    })

    tick(world, { secondary1: true, secondary2: true, secondary3: true })

    expect(world.query(SummonedCreature).length).toBe(3)
  })

  it('recolher um slot não afeta os outros', () => {
    const { world, player } = makeWorld()
    player.set(Party, { slot1: 'fox-red', slot2: 'fox-green' })

    tick(world, { secondary1: true, secondary2: true })
    tick(world, { secondary1: true }) // recolhe só o slot1

    const summoned = world.query(SummonedCreature)
    expect(summoned).toHaveLength(1)
    expect(summoned[0].get(SummonedCreature).slot).toBe('slot2')
  })

  it('espécie desconhecida no slot não quebra (não invoca nada)', () => {
    const { world, player } = makeWorld()
    player.set(Party, { slot1: 'nao-existe' })

    tick(world, { secondary1: true })

    expect(world.query(SummonedCreature).length).toBe(0)
  })
})
