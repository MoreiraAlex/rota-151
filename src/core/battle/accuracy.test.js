import { describe, expect, it } from 'vitest'
import {
  DEFAULT_ACCURACY,
  resolveHitChance,
  resolveMoveAccuracy,
  rollHit,
} from './accuracy'

describe('resolveMoveAccuracy', () => {
  it('sem `accuracy` é 100; `null` é "nunca erra"', () => {
    expect(resolveMoveAccuracy({})).toBe(DEFAULT_ACCURACY)
    expect(resolveMoveAccuracy({ accuracy: 70 })).toBe(70)
    expect(resolveMoveAccuracy({ accuracy: null })).toBeNull()
  })
})

describe('resolveHitChance', () => {
  it('100% com precisão normal é 1', () => {
    expect(resolveHitChance({ accuracy: 100 }, 0)).toBe(1)
  })

  it('o estágio de precisão do atacante multiplica a chance (-1 → 75%)', () => {
    expect(resolveHitChance({ accuracy: 100 }, -1)).toBeCloseTo(0.75)
    expect(resolveHitChance({ accuracy: 80 }, -1)).toBeCloseTo(0.6)
    expect(resolveHitChance({ accuracy: 100 }, -6)).toBeCloseTo(1 / 3)
  })

  it('estágio positivo não passa de 100%', () => {
    expect(resolveHitChance({ accuracy: 100 }, 3)).toBe(1)
  })

  it('golpe sem precisão (null) ignora o estágio', () => {
    expect(resolveHitChance({ accuracy: null }, -6)).toBe(1)
  })
})

describe('rollHit', () => {
  it('acerta quando o sorteio fica abaixo da chance, erra no resto', () => {
    const attack = { accuracy: 100 }
    expect(rollHit(attack, -1, () => 0.74)).toBe(true)
    expect(rollHit(attack, -1, () => 0.75)).toBe(false)
    expect(rollHit(attack, -1, () => 0.99)).toBe(false)
  })

  it('100% com estágio 0 nunca erra, qualquer sorteio válido (< 1)', () => {
    expect(rollHit({ accuracy: 100 }, 0, () => 0.999999)).toBe(true)
  })

  it('precisão 0 sempre erra', () => {
    expect(rollHit({ accuracy: 0 }, 0, () => 0)).toBe(false)
  })
})
