import { describe, it, expect } from 'vitest'
import { GAME_CONFIG } from '@/core/gameConfig'
import { getSpecies } from '@/core/data/species'
import {
  isBackStrike,
  resolveBallMultiplier,
  resolveCaptureChance,
  resolveCaptureValue,
  resolveConditionBonus,
  resolveShakeChance,
  resolveSpeciesCaptureRate,
  rollShake,
} from './capture'

const MAX_HP = 40
const RATE = GAME_CONFIG.CAPTURE.DEFAULT_RATE

function value(overrides = {}) {
  return resolveCaptureValue({
    hp: MAX_HP,
    maxHp: MAX_HP,
    rate: RATE,
    ...overrides,
  })
}

describe('chance de captura', () => {
  it('quanto menos vida, maior o valor', () => {
    expect(value({ hp: MAX_HP / 2 })).toBeGreaterThan(value({ hp: MAX_HP }))
    expect(value({ hp: 1 })).toBeGreaterThan(value({ hp: MAX_HP / 2 }))
  })

  it('com a vida cheia, vale um terço da taxa (fórmula Gen 3)', () => {
    expect(value()).toBeCloseTo(RATE / 3)
  })

  it('HP 0 (desmaiado) é o máximo do fator de vida', () => {
    expect(value({ hp: 0 })).toBeCloseTo(RATE)
    expect(value({ hp: 0 })).toBeGreaterThan(value({ hp: 1 }))
  })

  it('bola, condição e costas multiplicam o valor', () => {
    const base = value()
    expect(value({ ballMultiplier: 2 })).toBeCloseTo(base * 2)
    expect(value({ conditionBonus: 1.5 })).toBeCloseTo(base * 1.5)
    expect(value({ backStrikeBonus: 2 })).toBeCloseTo(base * 2)
  })

  it('chance por balançada cresce com o valor e captura direto no teto', () => {
    const max = GAME_CONFIG.CAPTURE.MAX_CAPTURE_VALUE
    expect(resolveShakeChance(max / 4)).toBeLessThan(
      resolveShakeChance(max / 2),
    )
    expect(resolveShakeChance(max)).toBe(1)
    expect(resolveShakeChance(max * 2)).toBe(1)
    expect(resolveShakeChance(0)).toBe(0)
  })

  it('a chance total é a de cada balançada elevada ao número de balançadas', () => {
    const shake = resolveShakeChance(GAME_CONFIG.CAPTURE.MAX_CAPTURE_VALUE / 3)
    const count = GAME_CONFIG.CAPTURE.SHAKE_COUNT
    expect(resolveCaptureChance(shake, count)).toBeCloseTo(shake ** count)
  })

  it('rollShake compara o rng com a chance; chance 1 sempre passa', () => {
    expect(rollShake(() => 0.2, 0.5)).toBe(true)
    expect(rollShake(() => 0.8, 0.5)).toBe(false)
    expect(rollShake(() => 0.999, 1)).toBe(true)
  })

  it('taxa da espécie, ou a padrão; multiplicador da bola, ou 1', () => {
    const species = getSpecies('charmander')
    expect(resolveSpeciesCaptureRate(species)).toBe(
      species.capture?.rate ?? GAME_CONFIG.CAPTURE.DEFAULT_RATE,
    )
    expect(resolveSpeciesCaptureRate({})).toBe(GAME_CONFIG.CAPTURE.DEFAULT_RATE)
    expect(resolveBallMultiplier({ pokeball: { captureMultiplier: 3 } })).toBe(
      3,
    )
    expect(resolveBallMultiplier(null)).toBe(1)
  })

  it('bônus de condição: o da config pra queimado, 1 sem condição', () => {
    expect(resolveConditionBonus([])).toBe(1)
    expect(resolveConditionBonus(['burn'])).toBe(
      GAME_CONFIG.CAPTURE.CONDITION_BONUS.burn,
    )
    expect(resolveConditionBonus(['desconhecida'])).toBe(1)
  })
})

describe('pelas costas', () => {
  // Selvagem olhando pra +Z (`Rotation.y` 0).
  const facingY = 0

  it('bola vindo de trás (andando pra +Z) num selvagem desatento conta', () => {
    expect(
      isBackStrike({
        unaware: true,
        facingY,
        ballVelocity: { x: 0, y: -1, z: 5 },
      }),
    ).toBe(true)
  })

  it('bola vindo de frente não conta', () => {
    expect(
      isBackStrike({
        unaware: true,
        facingY,
        ballVelocity: { x: 0, y: -1, z: -5 },
      }),
    ).toBe(false)
  })

  it('selvagem que já percebeu o treinador não conta', () => {
    expect(
      isBackStrike({
        unaware: false,
        facingY,
        ballVelocity: { x: 0, y: -1, z: 5 },
      }),
    ).toBe(false)
  })
})
