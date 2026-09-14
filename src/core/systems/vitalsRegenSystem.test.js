import { describe, it, expect } from 'vitest'
import { makeWorld } from '@/test/makeWorld'
import { Vitals } from '@/core/traits'
import { vitalsRegenSystem } from './vitalsRegenSystem'

function tick(world, delta = 1) {
  vitalsRegenSystem({ world, delta })
}

describe('vitalsRegenSystem', () => {
  it('regenera HP e stamina proporcionalmente ao % configurado e ao delta', () => {
    const { world, player } = makeWorld()
    player.set(Vitals, {
      hp: 50,
      maxHp: 100,
      hpRegenPercent: 10, // 10 hp/s
      stamina: 20,
      maxStamina: 100,
      staminaRegenPercent: 20, // 20 stamina/s
    })

    tick(world, 1)

    const vitals = player.get(Vitals)
    expect(vitals.hp).toBeCloseTo(60)
    expect(vitals.stamina).toBeCloseTo(40)
  })

  it('não passa do máximo', () => {
    const { world, player } = makeWorld()
    player.set(Vitals, {
      hp: 98,
      maxHp: 100,
      hpRegenPercent: 50,
      stamina: 99,
      maxStamina: 100,
      staminaRegenPercent: 50,
    })

    tick(world, 1)

    const vitals = player.get(Vitals)
    expect(vitals.hp).toBe(100)
    expect(vitals.stamina).toBe(100)
  })

  it('HP não regenera enquanto hpRegenDelay > 0 — stamina regenera igual', () => {
    const { world, player } = makeWorld()
    player.set(Vitals, {
      hp: 50,
      maxHp: 100,
      hpRegenPercent: 10,
      hpRegenDelay: 2,
      stamina: 50,
      maxStamina: 100,
      staminaRegenPercent: 10,
    })

    tick(world, 1)

    const vitals = player.get(Vitals)
    expect(vitals.hp).toBe(50) // não regenerou
    expect(vitals.hpRegenDelay).toBeCloseTo(1) // contou pra baixo
    expect(vitals.stamina).toBeCloseTo(60) // regenerou normal
  })

  it('HP volta a regenerar assim que o delay chega a zero', () => {
    const { world, player } = makeWorld()
    player.set(Vitals, {
      hp: 50,
      maxHp: 100,
      hpRegenPercent: 10,
      hpRegenDelay: 0.5,
    })

    tick(world, 0.5) // consome o resto do delay neste tick, sem regenerar ainda
    expect(player.get(Vitals).hp).toBe(50)
    expect(player.get(Vitals).hpRegenDelay).toBe(0)

    tick(world, 1) // delay já zerado — regenera normalmente
    expect(player.get(Vitals).hp).toBeCloseTo(60)
  })

  it('stamina não regenera enquanto staminaRegenDelay > 0 — HP regenera igual', () => {
    const { world, player } = makeWorld()
    player.set(Vitals, {
      hp: 50,
      maxHp: 100,
      hpRegenPercent: 10,
      stamina: 50,
      maxStamina: 100,
      staminaRegenPercent: 10,
      staminaRegenDelay: 2,
    })

    tick(world, 1)

    const vitals = player.get(Vitals)
    expect(vitals.stamina).toBe(50) // não regenerou
    expect(vitals.staminaRegenDelay).toBeCloseTo(1) // contou pra baixo
    expect(vitals.hp).toBeCloseTo(60) // regenerou normal
  })

  it('stamina volta a regenerar assim que staminaRegenDelay chega a zero', () => {
    const { world, player } = makeWorld()
    player.set(Vitals, {
      stamina: 50,
      maxStamina: 100,
      staminaRegenPercent: 10,
      staminaRegenDelay: 0.5,
    })

    tick(world, 0.5) // consome o resto do delay neste tick, sem regenerar ainda
    expect(player.get(Vitals).stamina).toBe(50)
    expect(player.get(Vitals).staminaRegenDelay).toBe(0)

    tick(world, 1) // delay já zerado — regenera normalmente
    expect(player.get(Vitals).stamina).toBeCloseTo(60)
  })
})
