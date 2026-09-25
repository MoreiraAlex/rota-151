import { afterEach, describe, expect, it } from 'vitest'
import { createWorld } from 'koota'
import { entrarEmCombate } from '../actions/combat'
import { GAME_CONFIG } from '../gameConfig'
import { CombatMode, Mood } from '../traits'
import { combatModeSystem } from './combatModeSystem'

const TIMEOUT = GAME_CONFIG.BATTLE.COMBAT_MODE_TIMEOUT
const worlds = []
function setup() {
  const world = createWorld()
  worlds.push(world)
  const creature = world.spawn(Mood)
  entrarEmCombate(creature)
  const advance = (seconds) => combatModeSystem({ world, delta: seconds })
  return { creature, advance }
}

afterEach(() => {
  while (worlds.length) worlds.pop().destroy()
})

describe('combatModeSystem', () => {
  it('continua em combate antes do tempo acabar', () => {
    const { creature, advance } = setup()

    advance(TIMEOUT - 0.5)

    expect(creature.has(CombatMode)).toBe(true)
    expect(creature.get(Mood).state).toBe('angry')
  })

  it('sai do combate quando o tempo acaba e o olho volta pra awake', () => {
    const { creature, advance } = setup()

    advance(TIMEOUT - 0.5)
    advance(0.6)

    expect(creature.has(CombatMode)).toBe(false)
    expect(creature.get(Mood).state).toBe('awake')
  })

  it('um novo ataque no meio renova os 10s', () => {
    const { creature, advance } = setup()

    advance(TIMEOUT - 1)
    entrarEmCombate(creature)
    advance(TIMEOUT - 1)

    expect(creature.has(CombatMode)).toBe(true)
  })
})
