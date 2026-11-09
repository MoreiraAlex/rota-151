import { afterEach, describe, expect, it } from 'vitest'
import { createWorld } from 'koota'
import { GAME_CONFIG } from '../gameConfig'
import { PartyBehavior, WildCreature } from '../traits'
import {
  applyAimError,
  resolveAiTuning,
  resolveHardTuning,
  resolvePartyTuning,
  resolveWildTuning,
} from './aiTuning'

const { EASY } = GAME_CONFIG.WILD_DIFFICULTY

describe('resolveWildTuning — dificuldade das selvagens', () => {
  it('no nível máximo devolve os valores de hoje (ponta difícil)', () => {
    expect(resolveWildTuning(1)).toEqual(resolveHardTuning())
  })

  it('no nível zero devolve a ponta fácil do config', () => {
    const tuning = resolveWildTuning(0)
    for (const key of Object.keys(EASY)) {
      expect(tuning[key]).toBeCloseTo(EASY[key])
    }
  })

  it('no meio, cada efeito fica entre as duas pontas', () => {
    const hard = resolveHardTuning()
    const tuning = resolveWildTuning(0.5)
    for (const key of Object.keys(hard)) {
      const low = Math.min(hard[key], EASY[key] ?? hard[key])
      const high = Math.max(hard[key], EASY[key] ?? hard[key])
      expect(tuning[key]).toBeGreaterThanOrEqual(low - 1e-9)
      expect(tuning[key]).toBeLessThanOrEqual(high + 1e-9)
    }
  })

  it('nível fora de 0–1 fica limitado às pontas', () => {
    expect(resolveWildTuning(2)).toEqual(resolveWildTuning(1))
    expect(resolveWildTuning(-1)).toEqual(resolveWildTuning(0))
  })

  it('a ponta difícil não erra a mira', () => {
    expect(resolveHardTuning().AIM_ERROR).toBe(0)
  })
})

describe('resolvePartyTuning — dificuldade do time (064)', () => {
  const PARTY_EASY = GAME_CONFIG.PARTY_DIFFICULTY.EASY

  it('no nível máximo devolve os valores de hoje do time, com o ritmo dele', () => {
    const hard = resolveHardTuning('party')
    expect(resolvePartyTuning(1)).toEqual(hard)
    expect(hard.ATTACK_INTERVAL).toBe(
      GAME_CONFIG.PARTY_BEHAVIOR.ATTACK_INTERVAL,
    )
  })

  it('no nível zero devolve a ponta fácil do time', () => {
    const tuning = resolvePartyTuning(0)
    for (const key of Object.keys(PARTY_EASY)) {
      expect(tuning[key]).toBeCloseTo(PARTY_EASY[key])
    }
  })

  it('na ponta difícil o time mira certo (sem erro, a direção é a do alvo)', () => {
    const direction = { x: 0, y: 0, z: 1 }
    const { AIM_ERROR } = resolvePartyTuning(1)
    expect(applyAimError(direction, AIM_ERROR, () => 0.9)).toBe(direction)
  })

  it('a ponta fácil erra mais e ataca mais devagar que a difícil', () => {
    const hard = resolveHardTuning('party')
    expect(PARTY_EASY.AIM_ERROR).toBeGreaterThan(hard.AIM_ERROR)
    expect(PARTY_EASY.ATTACK_INTERVAL).toBeGreaterThan(hard.ATTACK_INTERVAL)
  })
})

describe('resolveAiTuning — cada lado pela sua dificuldade', () => {
  const original = {
    wild: GAME_CONFIG.WILD_DIFFICULTY.LEVEL,
    party: GAME_CONFIG.PARTY_DIFFICULTY.LEVEL,
  }
  afterEach(() => {
    GAME_CONFIG.WILD_DIFFICULTY.LEVEL = original.wild
    GAME_CONFIG.PARTY_DIFFICULTY.LEVEL = original.party
  })

  function spawnBoth() {
    const world = createWorld()
    const wild = world.spawn(WildCreature({ speciesId: 'pidgey' }))
    const party = world.spawn(PartyBehavior)
    return { world, wild, party }
  }

  it('selvagem segue o WILD_DIFFICULTY; criatura do time, o PARTY_DIFFICULTY', () => {
    const { world, wild, party } = spawnBoth()
    expect(resolveAiTuning(wild)).toEqual(resolveWildTuning())
    expect(resolveAiTuning(party)).toEqual(resolvePartyTuning())
    world.destroy()
  })

  it('mudar a dificuldade de um lado não mexe no outro', () => {
    const { world, wild, party } = spawnBoth()
    GAME_CONFIG.WILD_DIFFICULTY.LEVEL = 1
    GAME_CONFIG.PARTY_DIFFICULTY.LEVEL = 1
    const wildBefore = resolveAiTuning(wild)
    const partyBefore = resolveAiTuning(party)

    GAME_CONFIG.PARTY_DIFFICULTY.LEVEL = 0
    expect(resolveAiTuning(wild)).toEqual(wildBefore)
    expect(resolveAiTuning(party)).not.toEqual(partyBefore)

    GAME_CONFIG.PARTY_DIFFICULTY.LEVEL = 1
    GAME_CONFIG.WILD_DIFFICULTY.LEVEL = 0
    expect(resolveAiTuning(party)).toEqual(partyBefore)
    expect(resolveAiTuning(wild)).not.toEqual(wildBefore)
    world.destroy()
  })
})

describe('applyAimError — erro de mira', () => {
  const direction = { x: 0, y: 0, z: 1 }

  it('sem erro, a direção é a do alvo', () => {
    expect(applyAimError(direction, 0, () => 0.9)).toBe(direction)
  })

  it('com erro, o desvio nunca passa do limite e a direção segue unitária', () => {
    const aimError = 0.4
    for (const roll of [0, 0.25, 0.5, 0.75, 0.999]) {
      const out = applyAimError(direction, aimError, () => roll)
      const angle = Math.abs(Math.atan2(out.x, out.z))
      expect(angle).toBeLessThanOrEqual(aimError + 1e-9)
      expect(Math.hypot(out.x, out.z)).toBeCloseTo(1)
    }
  })
})
