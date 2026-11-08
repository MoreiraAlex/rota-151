import { describe, expect, it } from 'vitest'
import { createWorld } from 'koota'
import { GAME_CONFIG } from '../gameConfig'
import { PartyBehavior, WildCreature } from '../traits'
import {
  applyAimError,
  resolveAiTuning,
  resolveHardTuning,
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

describe('resolveAiTuning — quem passa pela dificuldade', () => {
  it('selvagem usa a dificuldade; criatura do time, os valores de hoje', () => {
    const world = createWorld()
    const wild = world.spawn(WildCreature({ speciesId: 'pidgey' }))
    const party = world.spawn(PartyBehavior)
    expect(resolveAiTuning(wild)).toEqual(resolveWildTuning())
    expect(resolveAiTuning(party)).toEqual(resolveHardTuning())
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
