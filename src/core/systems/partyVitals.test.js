import { afterEach, describe, expect, it } from 'vitest'
import { givePartyPokemon, makeWorld } from '@/test/makeWorld'
import { colocarNoTime, tirarDoTime } from '../actions/pokemon'
import {
  ActionState,
  StoredFaint,
  StoredVitals,
  SummonBall,
  SummonedCreature,
  Vitals,
} from '../traits'
import { faintSystem } from './faintSystem'
import { partySummonSystem } from './partySummonSystem'
import { summonBallSystem } from './summonBallSystem'
import { regenerateVitals, vitalsRegenSystem } from './vitalsRegenSystem'

// Vida/energia do Pokémon guardadas fora de campo (`StoredVitals` do
// registro): recolher não reseta, e lá fora (no time ou no inventário)
// regenera como se estivesse em campo.

const DELTA = 1 / 60

const worlds = []
afterEach(() => {
  while (worlds.length) worlds.pop().destroy()
})

function tick(world, input = {}) {
  partySummonSystem({ world, delta: DELTA, input })
  summonBallSystem({ world, delta: DELTA })
}

function runUntilFree(world, player) {
  let guard = 0
  while (
    player.get(ActionState).current !== null ||
    world.query(SummonBall).length > 0
  ) {
    tick(world)
    if (++guard > 2000) throw new Error('ação/esfera nunca resolveu')
  }
}

function summon(world, player) {
  tick(world, { secondary1: true })
  runUntilFree(world, player)
  return world.query(SummonedCreature)[0]
}

function recall(world, player) {
  tick(world, { secondary1: true })
  runUntilFree(world, player)
}

function setup() {
  const { world, player } = makeWorld()
  worlds.push(world)
  const { slot1: pokemon } = givePartyPokemon(world, player, {
    slot1: 'bulbasaur',
  })
  return { world, player, pokemon }
}

describe('vida/energia fora de campo (StoredVitals)', () => {
  it('recolher e invocar de novo mantém a vida e a energia (não reseta)', () => {
    const { world, player, pokemon } = setup()
    const creature = summon(world, player)
    // Delays altos: nada regenera no meio, o valor tem que voltar igual.
    creature.set(Vitals, {
      hp: 10,
      stamina: 5,
      hpRegenDelay: 999,
      staminaRegenDelay: 999,
    })

    recall(world, player)
    expect(world.query(SummonedCreature).length).toBe(0)
    expect(pokemon.get(StoredVitals).vitals.hp).toBe(10)
    expect(pokemon.get(StoredVitals).vitals.stamina).toBe(5)

    const again = summon(world, player)
    const vitals = again.get(Vitals)
    expect(vitals.hp).toBe(10)
    expect(vitals.stamina).toBe(5)
    expect(vitals.hpRegenDelay).toBe(999)
    // Em campo, vale o `Vitals` da criatura; o registro é limpo.
    expect(pokemon.get(StoredVitals).vitals).toBe(null)
  })

  it('nunca invocada (nada guardado) sai cheia', () => {
    const { world, player } = setup()
    const vitals = summon(world, player).get(Vitals)
    expect(vitals.hp).toBe(vitals.maxHp)
    expect(vitals.stamina).toBe(vitals.maxStamina)
  })

  it('na bola regenera pela mesma regra de fora (delays inclusive)', () => {
    const { world, player, pokemon } = setup()
    const creature = summon(world, player)
    creature.set(Vitals, {
      hp: 10,
      stamina: 5,
      hpRegenDelay: 1,
      staminaRegenDelay: 0,
    })
    recall(world, player)
    const stored = pokemon.get(StoredVitals).vitals

    // Mesma conta, num objeto à parte, com a função usada em campo.
    const expected = { ...stored }
    for (let i = 0; i < 180; i++) {
      regenerateVitals(expected, DELTA)
      vitalsRegenSystem({ world, delta: DELTA })
    }

    const after = pokemon.get(StoredVitals).vitals
    expect(after.hp).toBeGreaterThan(stored.hp)
    expect(after.stamina).toBeGreaterThan(stored.stamina)
    expect(after.hp).toBeCloseTo(expected.hp)
    expect(after.stamina).toBeCloseTo(expected.stamina)
    expect(after.hpRegenDelay).toBe(0)
  })

  it('desmaiada na bola não regenera', () => {
    const { world, player, pokemon } = setup()
    const creature = summon(world, player)
    creature.set(Vitals, { hp: 10, stamina: 5, hpRegenDelay: 0 })
    recall(world, player)
    pokemon.add(StoredFaint({ timeLeft: 60 }))
    const stored = pokemon.get(StoredVitals).vitals

    for (let i = 0; i < 120; i++) vitalsRegenSystem({ world, delta: DELTA })

    expect(pokemon.get(StoredVitals).vitals.hp).toBe(stored.hp)
    expect(pokemon.get(StoredVitals).vitals.stamina).toBe(stored.stamina)
  })

  it('sair do time não cura, e quem volta é o mesmo Pokémon', () => {
    const { world, player, pokemon } = setup()
    const creature = summon(world, player)
    creature.set(Vitals, { hp: 10, hpRegenDelay: 999 })
    recall(world, player)

    tirarDoTime(world, player, pokemon)
    expect(pokemon.get(StoredVitals).vitals.hp).toBe(10)

    colocarNoTime(player, pokemon, 'slot1')
    expect(summon(world, player).get(Vitals).hp).toBe(10)
  })

  it('no inventário regenera e o desmaio conta, como no time', () => {
    const { world, player, pokemon } = setup()
    const creature = summon(world, player)
    creature.set(Vitals, { hp: 10, stamina: 5, hpRegenDelay: 0 })
    recall(world, player)
    tirarDoTime(world, player, pokemon)
    const stored = pokemon.get(StoredVitals).vitals

    for (let i = 0; i < 60; i++) vitalsRegenSystem({ world, delta: DELTA })
    expect(pokemon.get(StoredVitals).vitals.hp).toBeGreaterThan(stored.hp)

    pokemon.add(StoredFaint({ timeLeft: 0.5 }))
    for (let i = 0; i < 60; i++) faintSystem({ world, delta: DELTA })
    expect(pokemon.has(StoredFaint)).toBe(false)
  })
})
