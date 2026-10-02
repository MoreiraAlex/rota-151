import { describe, it, expect } from 'vitest'
import {
  isAttackChanneling,
  isAttackCharging,
  isAttackPastEffect,
  resolveAttackHitTime,
  resolveAttackTelegraphProgress,
} from './attackTelegraph'

const ATTACK = { duration: 1, effectAt: 0.4 }

function action(elapsed, duration = 1) {
  return { current: 'attack', elapsed, animationSpeed: 1 / duration }
}

describe('resolveAttackTelegraphProgress', () => {
  it('preenche de 0 até o instante do dano (effectAt), não até o fim da duração', () => {
    expect(resolveAttackTelegraphProgress(action(0), ATTACK)).toBe(0)
    expect(resolveAttackTelegraphProgress(action(0.2), ATTACK)).toBeCloseTo(0.5)
    expect(resolveAttackTelegraphProgress(action(0.39), ATTACK)).toBeCloseTo(
      0.975,
    )
  })

  it('depois do dano some (null)', () => {
    expect(resolveAttackTelegraphProgress(action(0.4), ATTACK)).toBeNull()
    expect(resolveAttackTelegraphProgress(action(0.9), ATTACK)).toBeNull()
  })

  it('acompanha a duração REAL da ação (básico escalado pelo speed): mesma proporção', () => {
    // Ação de 2s (definição 1s): dano em 0.8s.
    expect(resolveAttackTelegraphProgress(action(0.4, 2), ATTACK)).toBeCloseTo(
      0.5,
    )
    expect(resolveAttackTelegraphProgress(action(0.8, 2), ATTACK)).toBeNull()
  })

  it('fora de ataque, sem definição ou sem instante de dano → null', () => {
    expect(
      resolveAttackTelegraphProgress({ current: 'dash', elapsed: 0 }, ATTACK),
    ).toBeNull()
    expect(resolveAttackTelegraphProgress(action(0.1), null)).toBeNull()
    expect(
      resolveAttackTelegraphProgress(action(0.1), { duration: 1, effectAt: 0 }),
    ).toBeNull()
  })

  it('canalizado também some assim que enche, mesmo com o canal continuando', () => {
    const channel = { ...ATTACK, damageMode: 'channel' }
    expect(resolveAttackTelegraphProgress(action(0.2), channel)).toBeCloseTo(
      0.5,
    )
    expect(resolveAttackTelegraphProgress(action(0.4), channel)).toBeNull()
    expect(resolveAttackTelegraphProgress(action(0.9), channel)).toBeNull()
  })
})

describe('resolveAttackTelegraphProgress — golpe em si mesmo', () => {
  it('`area: "self"` (Growth) também tem aviso (o círculo da carga), até o effectAt', () => {
    const self = { ...ATTACK, area: 'self' }
    expect(resolveAttackTelegraphProgress(action(0.2), self)).toBeCloseTo(0.5)
    expect(resolveAttackTelegraphProgress(action(0.4), self)).toBeNull()
  })
})

describe('resolveAttackHitTime', () => {
  it('o effectAt real da ação: a razão da definição na duração real', () => {
    expect(resolveAttackHitTime(action(0), ATTACK)).toBeCloseTo(0.4)
    expect(resolveAttackHitTime(action(0, 2), ATTACK)).toBeCloseTo(0.8)
  })

  it('fora de ataque ou sem effectAt → null', () => {
    expect(resolveAttackHitTime({ current: null }, ATTACK)).toBeNull()
    expect(
      resolveAttackHitTime(action(0), { duration: 1, effectAt: 0 }),
    ).toBeNull()
  })
})

describe('isAttackCharging', () => {
  it('carregando do disparo até o effectAt; depois não', () => {
    expect(isAttackCharging(action(0), ATTACK)).toBe(true)
    expect(isAttackCharging(action(0.39), ATTACK)).toBe(true)
    expect(isAttackCharging(action(0.4), ATTACK)).toBe(false)
  })

  it('fora de ataque não', () => {
    expect(isAttackCharging({ current: null }, ATTACK)).toBe(false)
  })
})

describe('isAttackChanneling', () => {
  const CHANNEL = { ...ATTACK, damageMode: 'channel' }

  it('canalizado: do effectAt até a ação acabar', () => {
    expect(isAttackChanneling(action(0.3), CHANNEL)).toBe(false)
    expect(isAttackChanneling(action(0.4), CHANNEL)).toBe(true)
    expect(isAttackChanneling(action(0.9), CHANNEL)).toBe(true)
    expect(isAttackChanneling({ current: null }, CHANNEL)).toBe(false)
  })

  it('golpe que não é canalizado nunca', () => {
    expect(isAttackChanneling(action(0.9), ATTACK)).toBe(false)
  })
})

describe('isAttackPastEffect', () => {
  it('qualquer golpe: do effectAt até a ação acabar', () => {
    expect(isAttackPastEffect(action(0.39), ATTACK)).toBe(false)
    expect(isAttackPastEffect(action(0.4), ATTACK)).toBe(true)
    expect(isAttackPastEffect(action(0.9), ATTACK)).toBe(true)
    expect(isAttackPastEffect({ current: null }, ATTACK)).toBe(false)
  })
})
