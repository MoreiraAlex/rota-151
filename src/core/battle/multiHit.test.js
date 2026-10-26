import { describe, expect, it } from 'vitest'
import {
  countDueExtraHits,
  resolveExpectedHits,
  resolveLastHitAt,
  rollHitCount,
} from './multiHit'
import { getSkill } from '../data/skills'

const fury = getSkill('fury-attack')
const { counts, weights, interval } = fury.multiHit

describe('multiHit — golpe de vários acertos', () => {
  it('o sorteio só dá um dos números possíveis', () => {
    for (let i = 0; i < 50; i++) {
      expect(counts).toContain(rollHitCount(fury.multiHit, () => i / 50))
    }
  })

  it('o sorteio segue o peso de cada número', () => {
    const total = weights.reduce((sum, weight) => sum + weight, 0)
    // logo antes do fim da faixa de cada número, ainda é ele
    let edge = 0
    counts.forEach((count, i) => {
      edge += weights[i]
      expect(rollHitCount(fury.multiHit, () => (edge - 0.001) / total)).toBe(
        count,
      )
    })
  })

  it('os acertos seguintes vencem um por intervalo depois do primeiro', () => {
    const state = { count: counts.at(-1), done: 1 }
    const impactAt = fury.effectAt
    expect(countDueExtraHits(0, impactAt, impactAt, state, interval)).toBe(0)
    expect(
      countDueExtraHits(
        impactAt,
        impactAt + interval,
        impactAt,
        state,
        interval,
      ),
    ).toBe(1)
    // um passo longo pega todos de uma vez
    expect(countDueExtraHits(impactAt, 10, impactAt, state, interval)).toBe(
      state.count - 1,
    )
    // os que já foram não contam de novo
    expect(
      countDueExtraHits(
        0,
        10,
        impactAt,
        { ...state, done: state.count },
        interval,
      ),
    ).toBe(0)
    expect(countDueExtraHits(0, 10, impactAt, null, interval)).toBe(0)
  })

  it('o Fury Attack cabe inteiro na duração, até o último acerto possível', () => {
    expect(resolveLastHitAt(fury, fury.effectAt)).toBeLessThanOrEqual(
      fury.duration,
    )
  })
})

describe('resolveExpectedHits — a média de acertos', () => {
  it('é a média dos números pesada pelos pesos', () => {
    const expected =
      counts.reduce((sum, count, i) => sum + count * weights[i], 0) /
      weights.reduce((sum, weight) => sum + weight, 0)
    expect(resolveExpectedHits(fury.multiHit)).toBeCloseTo(expected)
    expect(resolveExpectedHits(fury.multiHit)).toBeGreaterThan(
      Math.min(...counts),
    )
    expect(resolveExpectedHits(fury.multiHit)).toBeLessThan(Math.max(...counts))
  })

  it('golpe de um acerto só: 1', () => {
    expect(resolveExpectedHits(undefined)).toBe(1)
  })
})
