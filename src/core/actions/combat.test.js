import { afterEach, describe, expect, it } from 'vitest'
import { createWorld } from 'koota'
import { GAME_CONFIG } from '../gameConfig'
import { CombatMode, Mood } from '../traits'
import { entrarEmCombate, sairDeCombate } from './combat'

const TIMEOUT = GAME_CONFIG.BATTLE.COMBAT_MODE_TIMEOUT
const worlds = []
function spawnCreature() {
  const world = createWorld()
  worlds.push(world)
  return world.spawn(Mood)
}

afterEach(() => {
  while (worlds.length) worlds.pop().destroy()
})

describe('entrarEmCombate / sairDeCombate', () => {
  it('entrar: ganha CombatMode com o tempo cheio e o olho fica angry', () => {
    const creature = spawnCreature()

    entrarEmCombate(creature)

    expect(creature.get(CombatMode).timeLeft).toBe(TIMEOUT)
    expect(creature.get(Mood).state).toBe('angry')
  })

  it('já em combate: renova o tempo sem mexer no humor', () => {
    const creature = spawnCreature()
    entrarEmCombate(creature)
    creature.set(CombatMode, { timeLeft: 2 })
    creature.set(Mood, { state: 'sleeping' }) // trocado na mão (debug)

    entrarEmCombate(creature)

    expect(creature.get(CombatMode).timeLeft).toBe(TIMEOUT)
    expect(creature.get(Mood).state).toBe('sleeping')
  })

  it('sair: perde o CombatMode e o olho volta pra awake', () => {
    const creature = spawnCreature()
    entrarEmCombate(creature)

    sairDeCombate(creature)

    expect(creature.has(CombatMode)).toBe(false)
    expect(creature.get(Mood).state).toBe('awake')
  })
})
