import { describe, expect, it } from 'vitest'
import { GAME_CONFIG } from '../gameConfig'
import {
  resolveBehaviorRadius,
  rollFlee,
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

describe('rollFlee — fuga clássica da pacífica (063)', () => {
  it('usa a chance da espécie (wild.fleeChance)', () => {
    expect(rollFlee(() => 0.99, { wild: { fleeChance: 1 } })).toBe(true)
    expect(rollFlee(() => 0, { wild: { fleeChance: 0 } })).toBe(false)
  })

  it('sem chance na espécie, usa DEFAULT_FLEE_CHANCE', () => {
    const chance = GAME_CONFIG.WILD_BEHAVIOR.DEFAULT_FLEE_CHANCE
    expect(rollFlee(() => chance - 0.01, {})).toBe(true)
    expect(rollFlee(() => chance + 0.01, {})).toBe(false)
  })
})

describe('resolveBehaviorRadius', () => {
  const { AGGRO_RADIUS, AGGRO_EXIT_MARGIN, RETALIATE_LEASH_RADIUS } =
    GAME_CONFIG.WILD_BEHAVIOR

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

  it('saindo do mapa: nenhum', () => {
    expect(
      resolveBehaviorRadius({ temperament: 'hostile', state: 'leave' }),
    ).toBeNull()
  })
})
