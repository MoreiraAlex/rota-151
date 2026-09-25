import { describe, it, expect } from 'vitest'
import { createRng, randomInt } from './rng'

describe('createRng', () => {
  it('mesmo seed produz a mesma sequência', () => {
    const a = createRng(151)
    const b = createRng(151)

    const sequenceA = [a(), a(), a()]
    const sequenceB = [b(), b(), b()]

    expect(sequenceA).toEqual(sequenceB)
  })

  it('seeds diferentes produzem sequências diferentes', () => {
    const a = createRng(1)
    const b = createRng(2)

    expect(a()).not.toBe(b())
  })

  it('cada chamada avança o estado — não repete o mesmo número toda vez', () => {
    const rng = createRng(42)
    const first = rng()
    const second = rng()

    expect(first).not.toBe(second)
  })

  it('sempre retorna um número em [0, 1)', () => {
    const rng = createRng(7)
    for (let i = 0; i < 50; i++) {
      const value = rng()
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThan(1)
    }
  })
})

describe('randomInt', () => {
  it('sempre cai dentro de [min, max], inclusive nos dois extremos', () => {
    const rng = createRng(9)
    for (let i = 0; i < 200; i++) {
      const value = randomInt(rng, 5, 8)
      expect(value).toBeGreaterThanOrEqual(5)
      expect(value).toBeLessThanOrEqual(8)
      expect(Number.isInteger(value)).toBe(true)
    }
  })

  it('min === max sempre retorna o mesmo valor', () => {
    const rng = createRng(3)
    expect(randomInt(rng, 10, 10)).toBe(10)
  })
})
