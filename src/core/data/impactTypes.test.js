import { describe, expect, it } from 'vitest'
import {
  IMPACT_TYPES,
  resolveAttackImpactType,
  resolveImpactType,
} from './impactTypes'

describe('resolveImpactType', () => {
  it('tipo válido passa; vazio, null e desconhecido caem em normal', () => {
    expect(IMPACT_TYPES).toHaveLength(18)
    expect(resolveImpactType('fire')).toBe('fire')
    expect(resolveImpactType('')).toBe('normal')
    expect(resolveImpactType(null)).toBe('normal')
    expect(resolveImpactType(undefined)).toBe('normal')
    expect(resolveImpactType('plasma')).toBe('normal')
  })
})

describe('resolveAttackImpactType', () => {
  it('visual.impactType vence; senão damage.type; senão normal', () => {
    expect(
      resolveAttackImpactType({
        visual: { impactType: 'fire' },
        damage: { type: 'water' },
      }),
    ).toBe('fire')
    expect(
      resolveAttackImpactType({ visual: {}, damage: { type: 'water' } }),
    ).toBe('water')
    expect(
      resolveAttackImpactType({ visual: {}, damage: { type: null } }),
    ).toBe('normal')
    expect(resolveAttackImpactType(null)).toBe('normal')
  })
})
