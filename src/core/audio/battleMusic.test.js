import { afterEach, describe, expect, it } from 'vitest'
import { makeWorld, spawnTrainer } from '@/test/makeWorld'
import { spawnWild } from '@/test/spawnWild'
import {
  BeingCaptured,
  CombatMode,
  Fainted,
  OwnedBy,
  PartyBehavior,
  SummonedCreature,
  WildBehavior,
} from '../traits'
import { advanceBattleHold, isGroupInBattle } from './battleMusic'

// Regras da música de batalha (docs/features/065-sons-do-mundo.md, Parte 3).
const worlds = []
afterEach(() => {
  while (worlds.length) worlds.pop().destroy()
})

function setup() {
  const { world, player } = makeWorld()
  worlds.push(world)
  return { world, player }
}

const summon = (world, trainer) =>
  world.spawn(
    SummonedCreature({ slot: 'slot1' }),
    PartyBehavior,
    OwnedBy(trainer),
  )

function chasing(world, target) {
  const wild = spawnWild(world)
  wild.set(WildBehavior, { ...wild.get(WildBehavior), state: 'chase', target })
  return wild
}

describe('isGroupInBattle', () => {
  it('sem ninguém lutando, não há luta', () => {
    const { world, player } = setup()
    summon(world, player)
    spawnWild(world)
    expect(isGroupInBattle(world, player)).toBe(false)
  })

  it('golpe no vazio (só o modo combate) não conta', () => {
    const { world, player } = setup()
    player.add(CombatMode)
    summon(world, player).add(CombatMode)
    expect(isGroupInBattle(world, player)).toBe(false)
  })

  it('uma criatura do time lutando com uma selvagem conta', () => {
    const { world, player } = setup()
    const creature = summon(world, player)
    creature.set(PartyBehavior, {
      ...creature.get(PartyBehavior),
      state: 'fight',
      target: spawnWild(world),
    })
    expect(isGroupInBattle(world, player)).toBe(true)
  })

  it('uma selvagem perseguindo o treinador ou o time conta', () => {
    const { world, player } = setup()
    chasing(world, player)
    expect(isGroupInBattle(world, player)).toBe(true)

    const other = setup()
    chasing(other.world, summon(other.world, other.player))
    expect(isGroupInBattle(other.world, other.player)).toBe(true)
  })

  it('luta de outro treinador ou só entre selvagens não conta', () => {
    const { world, player } = setup()
    const stranger = spawnTrainer(world)
    const theirs = summon(world, stranger)
    theirs.set(PartyBehavior, {
      ...theirs.get(PartyBehavior),
      state: 'fight',
      target: spawnWild(world),
    })
    chasing(world, stranger)
    chasing(world, spawnWild(world))
    expect(isGroupInBattle(world, player)).toBe(false)
  })

  it('selvagem desmaiada ou sendo capturada não conta, mesmo parada em chase', () => {
    for (const out of [Fainted, BeingCaptured]) {
      const { world, player } = setup()
      chasing(world, summon(world, player)).add(out)
      expect(isGroupInBattle(world, player)).toBe(false)
    }
  })

  it('time lutando com uma selvagem que desmaiou não conta', () => {
    const { world, player } = setup()
    const wild = spawnWild(world)
    const creature = summon(world, player)
    creature.set(PartyBehavior, {
      ...creature.get(PartyBehavior),
      state: 'fight',
      target: wild,
    })
    wild.add(Fainted)
    expect(isGroupInBattle(world, player)).toBe(false)
  })

  it('selvagem que não está perseguindo não conta', () => {
    const { world, player } = setup()
    const wild = chasing(world, player)
    wild.set(WildBehavior, { ...wild.get(WildBehavior), state: 'leave' })
    expect(isGroupInBattle(world, player)).toBe(false)
  })
})

describe('advanceBattleHold', () => {
  const HOLD = 2

  it('entra na hora', () => {
    expect(advanceBattleHold(null, true, 0.1, HOLD).active).toBe(true)
  })

  it('só sai depois da espera sem luta', () => {
    let hold = advanceBattleHold(null, true, 0.1, HOLD)
    hold = advanceBattleHold(hold, false, HOLD / 2, HOLD)
    expect(hold.active).toBe(true)
    hold = advanceBattleHold(hold, false, HOLD / 2, HOLD)
    expect(hold.active).toBe(false)
  })

  it('luta de novo no meio da espera zera a contagem', () => {
    let hold = advanceBattleHold(null, true, 0.1, HOLD)
    hold = advanceBattleHold(hold, false, HOLD * 0.9, HOLD)
    hold = advanceBattleHold(hold, true, 0.1, HOLD)
    hold = advanceBattleHold(hold, false, HOLD * 0.9, HOLD)
    expect(hold.active).toBe(true)
  })

  it('sem luta e fora da batalha, continua fora', () => {
    expect(advanceBattleHold(null, false, 0.1, HOLD).active).toBe(false)
  })
})
