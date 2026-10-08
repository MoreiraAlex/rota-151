import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { makeWorld, givePokemon } from '@/test/makeWorld'
import { createEventQueue, EVENT_TYPES } from '@/core/events'
import { GAME_CONFIG } from '@/core/gameConfig'
import { StoredConditions, StoredFaint, StoredVitals } from '@/core/traits'
import { storedConditionSystem } from './storedConditionSystem'

const DELTA = 1 / 60
const BURN = {
  timeLeft: 5,
  tickTimer: 1,
  fraction: 0.1,
  interval: 1,
  attackMultiplier: 1,
}

let world
let player
let events
const worlds = []
beforeEach(() => {
  ;({ world, player } = makeWorld())
  worlds.push(world)
  events = createEventQueue()
})
afterEach(() => {
  while (worlds.length) worlds.pop().destroy()
})

function run(seconds) {
  const ticks = Math.round(seconds / DELTA)
  for (let i = 0; i < ticks; i++) {
    storedConditionSystem({ world, delta: DELTA, events })
  }
}

function burnedPokemon(hp, burn = BURN) {
  const pokemon = givePokemon(world, player, 'charmander')
  pokemon.set(StoredVitals, {
    vitals: { hp, maxHp: 30, stamina: 10, maxStamina: 10 },
  })
  pokemon.add(StoredConditions({ burn: { ...burn } }))
  return pokemon
}

describe('storedConditionSystem', () => {
  it('a queimadura continua tirando vida dentro da bola', () => {
    const pokemon = burnedPokemon(30)
    run(BURN.interval + DELTA)
    expect(pokemon.get(StoredVitals).vitals.hp).toBeLessThan(30)
  })

  it('acabou o tempo: a condição sai do registro', () => {
    const pokemon = burnedPokemon(30, { ...BURN, timeLeft: 0.5 })
    run(1)
    expect(pokemon.has(StoredConditions)).toBe(false)
  })

  it('zerou a vida: desmaia dentro da bola', () => {
    const pokemon = burnedPokemon(1)
    run(BURN.interval + DELTA)

    expect(pokemon.get(StoredVitals).vitals.hp).toBe(0)
    expect(pokemon.get(StoredFaint).timeLeft).toBeCloseTo(
      GAME_CONFIG.FAINT.DURATION_MINUTES * 60,
    )
    expect(pokemon.has(StoredConditions)).toBe(false)
    const fainted = events
      .drain()
      .filter((event) => event.type === EVENT_TYPES.CREATURE_FAINTED)
    expect(fainted).toHaveLength(1)
  })

  it('desmaiado não queima mais', () => {
    const pokemon = burnedPokemon(20)
    pokemon.add(StoredFaint({ timeLeft: 10 }))
    run(BURN.interval * 2)
    expect(pokemon.get(StoredVitals).vitals.hp).toBe(20)
  })
})
