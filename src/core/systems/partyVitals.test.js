import { afterEach, describe, expect, it } from 'vitest'
import { makeWorld } from '@/test/makeWorld'
import { equiparCriatura } from '../actions/party'
import {
  ActionState,
  Party,
  PartyFaint,
  PartyVitals,
  SummonBall,
  SummonedCreature,
  Vitals,
} from '../traits'
import { partySummonSystem } from './partySummonSystem'
import { summonBallSystem } from './summonBallSystem'
import { regenerateVitals, vitalsRegenSystem } from './vitalsRegenSystem'

// Vida/energia da criatura do time guardadas na bola (`PartyVitals`):
// recolher não reseta, e lá dentro regenera como se estivesse fora.

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
  player.set(Party, { slot1: 'fox-red' })
  return { world, player }
}

describe('vida/energia do time na bola (PartyVitals)', () => {
  it('recolher e invocar de novo mantém a vida e a energia (não reseta)', () => {
    const { world, player } = setup()
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
    expect(player.get(PartyVitals).slot1.hp).toBe(10)
    expect(player.get(PartyVitals).slot1.stamina).toBe(5)

    const again = summon(world, player)
    const vitals = again.get(Vitals)
    expect(vitals.hp).toBe(10)
    expect(vitals.stamina).toBe(5)
    expect(vitals.hpRegenDelay).toBe(999)
    // Em campo, vale o `Vitals` da criatura; o slot é limpo.
    expect(player.get(PartyVitals).slot1).toBe(null)
  })

  it('nunca invocada (nada guardado) sai cheia', () => {
    const { world, player } = setup()
    const vitals = summon(world, player).get(Vitals)
    expect(vitals.hp).toBe(vitals.maxHp)
    expect(vitals.stamina).toBe(vitals.maxStamina)
  })

  it('na bola regenera pela mesma regra de fora (delays inclusive)', () => {
    const { world, player } = setup()
    const creature = summon(world, player)
    creature.set(Vitals, {
      hp: 10,
      stamina: 5,
      hpRegenDelay: 1,
      staminaRegenDelay: 0,
    })
    recall(world, player)
    const stored = player.get(PartyVitals).slot1

    // Mesma conta, num objeto à parte, com a função usada em campo.
    const expected = { ...stored }
    for (let i = 0; i < 180; i++) {
      regenerateVitals(expected, DELTA)
      vitalsRegenSystem({ world, delta: DELTA })
    }

    const after = player.get(PartyVitals).slot1
    expect(after.hp).toBeGreaterThan(stored.hp)
    expect(after.stamina).toBeGreaterThan(stored.stamina)
    expect(after.hp).toBeCloseTo(expected.hp)
    expect(after.stamina).toBeCloseTo(expected.stamina)
    expect(after.hpRegenDelay).toBe(0)
  })

  it('desmaiada na bola não regenera', () => {
    const { world, player } = setup()
    const creature = summon(world, player)
    creature.set(Vitals, { hp: 10, stamina: 5, hpRegenDelay: 0 })
    recall(world, player)
    player.set(PartyFaint, { slot1: { timeLeft: 60 } })
    const stored = player.get(PartyVitals).slot1

    for (let i = 0; i < 120; i++) vitalsRegenSystem({ world, delta: DELTA })

    expect(player.get(PartyVitals).slot1.hp).toBe(stored.hp)
    expect(player.get(PartyVitals).slot1.stamina).toBe(stored.stamina)
  })

  it('trocar a criatura do slot limpa a vida guardada (criatura nova sai cheia)', () => {
    const { world, player } = setup()
    const creature = summon(world, player)
    creature.set(Vitals, { hp: 10, hpRegenDelay: 999 })
    recall(world, player)
    expect(player.get(PartyVitals).slot1).not.toBe(null)

    equiparCriatura(player, 'slot1', 'fox-red')

    expect(player.get(PartyVitals).slot1).toBe(null)
  })
})
