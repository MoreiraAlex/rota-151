import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { makeWorld, givePokemon } from '@/test/makeWorld'
import { spawnWild } from '@/test/spawnWild'
import { Burn, BurnedBy, StoredConditions } from '@/core/traits'
import { queimar, resolveBurnDamage } from './burn'
import {
  avancarQueimaduraGuardada,
  devolverCondicoes,
  guardarCondicoes,
} from './conditions'

const BURN_EFFECT = {
  type: 'burn',
  chance: 1,
  fraction: 0.05,
  interval: 1,
  duration: 10,
}

let world
let player
const worlds = []
beforeEach(() => {
  ;({ world, player } = makeWorld())
  worlds.push(world)
})
afterEach(() => {
  while (worlds.length) worlds.pop().destroy()
})

describe('guardar e devolver condições', () => {
  it('a queimadura vai pro registro e volta pra criatura com o tempo que falta', () => {
    const creature = spawnWild(world)
    queimar(creature, player, BURN_EFFECT, () => 0)
    creature.set(Burn, { timeLeft: 4 })
    const pokemon = givePokemon(world, player, 'charmander')

    guardarCondicoes(creature, pokemon)
    expect(pokemon.get(StoredConditions).burn.timeLeft).toBe(4)

    const next = spawnWild(world)
    devolverCondicoes(pokemon, next)
    expect(next.get(Burn).timeLeft).toBe(4)
    expect(next.has(BurnedBy('*'))).toBe(false)
    expect(pokemon.has(StoredConditions)).toBe(false)
  })

  it('sem condição, o registro fica sem nada guardado', () => {
    const creature = spawnWild(world)
    const pokemon = givePokemon(world, player, 'charmander')
    pokemon.add(StoredConditions({ burn: { timeLeft: 1 } }))

    guardarCondicoes(creature, pokemon)

    expect(pokemon.has(StoredConditions)).toBe(false)
  })
})

describe('avancarQueimaduraGuardada', () => {
  const vitals = { hp: 30, maxHp: 30 }
  const burn = { timeLeft: 10, tickTimer: 1, fraction: 0.1, interval: 1 }

  it('tira o dano da queimadura a cada intervalo, como em campo', () => {
    const next = avancarQueimaduraGuardada(burn, vitals, 1)
    expect(next.vitals.hp).toBe(
      vitals.hp - resolveBurnDamage(vitals, burn.fraction),
    )
    expect(next.burn.timeLeft).toBe(burn.timeLeft - 1)
  })

  it('antes do intervalo, só conta o tempo', () => {
    const next = avancarQueimaduraGuardada(burn, vitals, 0.5)
    expect(next.vitals).toBe(vitals)
    expect(next.burn.tickTimer).toBe(0.5)
  })

  it('acaba o tempo: a queimadura sai', () => {
    const next = avancarQueimaduraGuardada(
      { ...burn, timeLeft: 0.5 },
      vitals,
      0.5,
    )
    expect(next.burn).toBe(null)
  })

  it('zerou a vida: para de queimar', () => {
    const next = avancarQueimaduraGuardada(burn, { hp: 1, maxHp: 30 }, 1)
    expect(next.vitals.hp).toBe(0)
    expect(next.burn).toBe(null)
  })
})
