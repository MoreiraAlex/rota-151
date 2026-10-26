import { describe, it, expect } from 'vitest'
import { createRng } from '../rng'
import {
  countChannelTicks,
  isChannelAttack,
  isChargeAttack,
  isAreaAttack,
  isBeamAttack,
  isCircleAttack,
  isConeAttack,
  isSelfAttack,
  resolveChannelTickCount,
  rollChannelWeights,
} from './channelAttack'

const CHANNEL = { effectAt: 0.5, damageInterval: 0.25, duration: 1.5 }

function totalTicks(attack, step) {
  let total = 0
  for (let t = 0; t < attack.duration + step; t += step) {
    total += countChannelTicks(t, t + step, attack)
  }
  return total
}

describe('channelAttack', () => {
  it('isConeAttack: a forma do grupo (area "cone"), canalizado ou de impacto único', () => {
    expect(isConeAttack({ area: 'cone' })).toBe(true)
    expect(isConeAttack({ execution: 'channel', area: 'cone' })).toBe(true)
    // canalizado na cápsula é feixe, não cone
    expect(isConeAttack({ execution: 'channel' })).toBe(false)
    expect(isConeAttack({})).toBe(false)
    expect(isConeAttack(null)).toBe(false)
    // um cone de impacto único NÃO é canalizado (não repete dano por tick)
    expect(isChannelAttack({ area: 'cone' })).toBe(false)
  })

  it('isChannelAttack só pra execution channel; isChargeAttack só pra charge', () => {
    expect(isChannelAttack({ execution: 'channel' })).toBe(true)
    expect(isChannelAttack({ execution: 'charge' })).toBe(false)
    expect(isChannelAttack({})).toBe(false)
    expect(isChannelAttack(null)).toBe(false)
    expect(isChargeAttack({ execution: 'charge' })).toBe(true)
    expect(isChargeAttack({ execution: 'instant' })).toBe(false)
    expect(isChargeAttack(null)).toBe(false)
  })

  it('primeiro tick no effectAt, depois a cada damageInterval', () => {
    expect(countChannelTicks(0.4, 0.49, CHANNEL)).toBe(0)
    expect(countChannelTicks(0.49, 0.51, CHANNEL)).toBe(1) // 0.5
    expect(countChannelTicks(0.51, 0.74, CHANNEL)).toBe(0)
    expect(countChannelTicks(0.74, 0.76, CHANNEL)).toBe(1) // 0.75
  })

  it('total na ação inteira não depende do passo: 0.5, 0.75, 1, 1.25, 1.5', () => {
    expect(totalTicks(CHANNEL, 1 / 60)).toBe(5)
    expect(totalTicks(CHANNEL, 0.1)).toBe(5)
    expect(totalTicks(CHANNEL, 0.7)).toBe(5) // passo grande: vários por vez
  })

  it('nada depois da duration', () => {
    expect(countChannelTicks(1.5, 2, CHANNEL)).toBe(0)
  })

  it('sem damageInterval: um tick só, no effectAt', () => {
    const once = { effectAt: 0.5, duration: 1.5 }
    expect(totalTicks(once, 1 / 60)).toBe(1)
  })

  it('resolveChannelTickCount: todos os ticks da ação inteira', () => {
    expect(resolveChannelTickCount(CHANNEL)).toBe(5)
    expect(resolveChannelTickCount({ effectAt: 0.5, duration: 1.5 })).toBe(1)
  })

  it('rollChannelWeights: frações diferentes entre si que somam exatamente 1', () => {
    const weights = rollChannelWeights(5, createRng(42))

    expect(weights).toHaveLength(5)
    expect(weights.reduce((sum, w) => sum + w, 0)).toBeCloseTo(1, 10)
    expect(new Set(weights.map((w) => w.toFixed(6))).size).toBeGreaterThan(1)
    // Cada uma perto de 1/5: a variação é a do fator aleatório (85%-100%).
    for (const w of weights) {
      expect(w).toBeGreaterThan(0.85 / 5 / 1.0 - 0.02)
      expect(w).toBeLessThan(1 / 5 / 0.85 + 0.02)
    }
  })

  it('rollChannelWeights sem ticks → vazio', () => {
    expect(rollChannelWeights(0, createRng(1))).toEqual([])
  })
})

describe('isSelfAttack', () => {
  it('só `area: "self"` age em quem usou', () => {
    expect(isSelfAttack({ area: 'self' })).toBe(true)
    expect(isSelfAttack({ area: 'cone' })).toBe(false)
    expect(isSelfAttack({})).toBe(false)
    expect(isSelfAttack(null)).toBe(false)
  })

  it('golpe em si mesmo não é cone', () => {
    expect(isConeAttack({ area: 'self' })).toBe(false)
  })
})

describe('isBeamAttack', () => {
  it('canalizado na cápsula (sem area) é feixe (e não é cone)', () => {
    const beam = { execution: 'channel' }
    expect(isBeamAttack(beam)).toBe(true)
    expect(isConeAttack(beam)).toBe(false)
  })

  it('sem canal, ou canalizado em cone ou em si mesmo, não é feixe', () => {
    expect(isBeamAttack({})).toBe(false)
    expect(isBeamAttack({ execution: 'channel', area: 'cone' })).toBe(false)
    expect(isBeamAttack({ execution: 'channel', area: 'self' })).toBe(false)
    expect(isBeamAttack({ execution: 'channel', area: 'circle' })).toBe(false)
  })
})

describe('isCircleAttack / isAreaAttack', () => {
  it('círculo e cone são área; cápsula e em si mesmo não', () => {
    expect(isCircleAttack({ area: 'circle' })).toBe(true)
    expect(isCircleAttack({ area: 'cone' })).toBe(false)
    expect(isAreaAttack({ area: 'circle' })).toBe(true)
    expect(isAreaAttack({ area: 'cone' })).toBe(true)
    expect(isAreaAttack({ area: 'self' })).toBe(false)
    expect(isAreaAttack({})).toBe(false)
  })
})
