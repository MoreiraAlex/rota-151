import { describe, expect, it } from 'vitest'
import { GAME_CONFIG } from '../gameConfig'
import {
  isLowHp,
  isRecoveredFromLowHp,
  resolveBehaviorRadius,
  resolveRetaliateChance,
  rollAttackReaction,
  rollLowHpFlee,
  rollTemperament,
} from './wildBehavior'

describe('rollTemperament', () => {
  it('usa a chance da espécie (wild.hostileChance)', () => {
    expect(rollTemperament(() => 0.99, { wild: { hostileChance: 1 } })).toBe(
      'hostile',
    )
    expect(rollTemperament(() => 0, { wild: { hostileChance: 0 } })).toBe(
      'peaceful',
    )
  })

  it('sem chance na espécie, usa DEFAULT_HOSTILE_CHANCE', () => {
    const chance = GAME_CONFIG.WILD_BEHAVIOR.DEFAULT_HOSTILE_CHANCE
    expect(rollTemperament(() => chance - 0.01, {})).toBe('hostile')
    expect(rollTemperament(() => chance + 0.01, {})).toBe('peaceful')
  })
})

describe('rollAttackReaction', () => {
  it('abaixo de RETALIATE_CHANCE revida; acima, foge', () => {
    const chance = GAME_CONFIG.WILD_BEHAVIOR.RETALIATE_CHANCE
    expect(rollAttackReaction(() => chance - 0.01)).toBe('retaliate')
    expect(rollAttackReaction(() => chance + 0.01)).toBe('flee')
  })

  it('com a chance passada (coragem), usa ela', () => {
    expect(rollAttackReaction(() => 0.8, 0.9)).toBe('retaliate')
    expect(rollAttackReaction(() => 0.2, 0.1)).toBe('flee')
  })
})

describe('resolveRetaliateChance — coragem da pacífica', () => {
  const {
    RETALIATE_CHANCE,
    COURAGE_HP_WEIGHT,
    COURAGE_HIT_WEIGHT,
    COURAGE_ADVANTAGE_WEIGHT,
    COURAGE_MIN_CHANCE,
    COURAGE_MAX_CHANCE,
  } = GAME_CONFIG.WILD_BEHAVIOR
  const at = (hp) => ({ hp, maxHp: 100 })

  it('meia vida, golpe zero, agressor igual: a chance base', () => {
    expect(resolveRetaliateChance(at(50), at(50), 0)).toBeCloseTo(
      RETALIATE_CHANCE,
    )
  })

  it('mais vida dá coragem; golpe forte tira; agressor mais fraco dá', () => {
    expect(resolveRetaliateChance(at(80), at(80), 0)).toBeCloseTo(
      RETALIATE_CHANCE + COURAGE_HP_WEIGHT * 0.3,
    )
    expect(resolveRetaliateChance(at(50), at(50), 10)).toBeCloseTo(
      RETALIATE_CHANCE - COURAGE_HIT_WEIGHT * 0.1,
    )
    expect(resolveRetaliateChance(at(50), at(30), 0)).toBeCloseTo(
      RETALIATE_CHANCE + COURAGE_ADVANTAGE_WEIGHT * 0.2,
    )
  })

  it('sem vida do agressor, conta como cheia; sempre entre MIN e MAX', () => {
    expect(resolveRetaliateChance(at(50), null, 0)).toBeCloseTo(
      RETALIATE_CHANCE - COURAGE_ADVANTAGE_WEIGHT * 0.5,
    )
    expect(resolveRetaliateChance(at(5), at(100), 90)).toBe(COURAGE_MIN_CHANCE)
    expect(resolveRetaliateChance(at(100), at(1), 0)).toBe(COURAGE_MAX_CHANCE)
  })
})

describe('fuga com HP baixo — limites e sorteio', () => {
  const { LOW_HP_FLEE_FRACTION, LOW_HP_RECOVER_FRACTION, LOW_HP_FLEE_CHANCE } =
    GAME_CONFIG.WILD_BEHAVIOR
  const at = (fraction) => ({ hp: fraction * 100, maxHp: 100 })

  it('vida baixa no limite ou abaixo; recuperada no limite de volta', () => {
    expect(isLowHp(at(LOW_HP_FLEE_FRACTION))).toBe(true)
    expect(isLowHp(at(LOW_HP_FLEE_FRACTION + 0.01))).toBe(false)
    expect(isRecoveredFromLowHp(at(LOW_HP_RECOVER_FRACTION))).toBe(true)
    expect(isRecoveredFromLowHp(at(LOW_HP_RECOVER_FRACTION - 0.01))).toBe(false)
  })

  it('sorteio pela LOW_HP_FLEE_CHANCE', () => {
    expect(rollLowHpFlee(() => LOW_HP_FLEE_CHANCE - 0.01)).toBe(true)
    expect(rollLowHpFlee(() => LOW_HP_FLEE_CHANCE + 0.01)).toBe(false)
  })
})

describe('resolveBehaviorRadius', () => {
  const {
    AGGRO_RADIUS,
    AGGRO_EXIT_MARGIN,
    RETALIATE_LEASH_RADIUS,
    FLEE_SAFE_DISTANCE,
  } = GAME_CONFIG.WILD_BEHAVIOR

  it('hostil vagando: raio de aggro; pacífica vagando: nenhum', () => {
    expect(
      resolveBehaviorRadius({ temperament: 'hostile', state: 'wander' }),
    ).toBe(AGGRO_RADIUS)
    expect(
      resolveBehaviorRadius({ temperament: 'peaceful', state: 'wander' }),
    ).toBeNull()
  })

  it('perseguindo: onde desiste — maior se provocada', () => {
    expect(resolveBehaviorRadius({ state: 'chase', provoked: false })).toBe(
      AGGRO_RADIUS + AGGRO_EXIT_MARGIN,
    )
    expect(resolveBehaviorRadius({ state: 'chase', provoked: true })).toBe(
      RETALIATE_LEASH_RADIUS,
    )
  })

  it('fugindo: distância segura', () => {
    expect(resolveBehaviorRadius({ state: 'flee' })).toBe(FLEE_SAFE_DISTANCE)
  })
})
