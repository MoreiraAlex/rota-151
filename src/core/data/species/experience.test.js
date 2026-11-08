import { describe, expect, it } from 'vitest'
import { GAME_CONFIG } from '../../gameConfig'
import {
  GROWTH_RATES,
  calculateExperienceGain,
  experienceForLevel,
  createLevelState,
  levelForExperience,
  resolveLevelCap,
  resolveLevelProgress,
} from './experience'

const { MAX_LEVEL } = GAME_CONFIG.EXPERIENCE
// O teto desta versão (docs/features/062-spawn-estilo-cobblemon.md): a
// curva vai até o oficial, mas ninguém passa do da versão.
const CAP = resolveLevelCap()

describe('experienceForLevel', () => {
  it.each(GROWTH_RATES)('%s: nível 1 é zero e a curva só cresce', (rate) => {
    expect(experienceForLevel(rate, 1)).toBe(0)
    for (let level = 2; level <= MAX_LEVEL; level++) {
      expect(experienceForLevel(rate, level)).toBeGreaterThan(
        experienceForLevel(rate, level - 1),
      )
    }
  })

  it('não passa do nível máximo', () => {
    expect(experienceForLevel('medium-slow', MAX_LEVEL + 5)).toBe(
      experienceForLevel('medium-slow', MAX_LEVEL),
    )
  })

  it('o multiplicador da curva escala o XP de todo nível', () => {
    const original = GAME_CONFIG.EXPERIENCE.CURVE_MULTIPLIER
    try {
      GAME_CONFIG.EXPERIENCE.CURVE_MULTIPLIER = 1
      const base = experienceForLevel('medium-fast', 50)
      GAME_CONFIG.EXPERIENCE.CURVE_MULTIPLIER = 2
      expect(experienceForLevel('medium-fast', 50)).toBe(base * 2)
    } finally {
      GAME_CONFIG.EXPERIENCE.CURVE_MULTIPLIER = original
    }
  })

  it('grupo desconhecido cai no padrão da config', () => {
    expect(experienceForLevel('???', 10)).toBe(
      experienceForLevel(GAME_CONFIG.EXPERIENCE.DEFAULT_GROWTH_RATE, 10),
    )
  })
})

describe('levelForExperience', () => {
  it.each(GROWTH_RATES)(
    '%s: inverte experienceForLevel até o teto da versão',
    (rate) => {
      for (let level = 1; level <= CAP; level++) {
        const xp = experienceForLevel(rate, level)
        expect(levelForExperience(rate, xp)).toBe(level)
        if (level > 1) expect(levelForExperience(rate, xp - 1)).toBe(level - 1)
      }
    },
  )

  it('para no teto da versão', () => {
    expect(levelForExperience('fast', Number.MAX_SAFE_INTEGER)).toBe(CAP)
  })
})

describe('resolveLevelCap', () => {
  it('é o da versão, nunca acima do oficial', () => {
    expect(CAP).toBeLessThanOrEqual(MAX_LEVEL)
    expect(CAP).toBeLessThanOrEqual(GAME_CONFIG.EXPERIENCE.LEVEL_CAP)
  })

  it('ninguém nasce acima dele', () => {
    expect(createLevelState({}, CAP + 5).level).toBe(CAP)
  })
})

describe('resolveLevelProgress', () => {
  it('vai de 0 no começo do nível até perto de 1 no fim', () => {
    const start = experienceForLevel('medium-slow', 10)
    const end = experienceForLevel('medium-slow', 11)
    expect(resolveLevelProgress('medium-slow', 10, start)).toBe(0)
    const almost = resolveLevelProgress('medium-slow', 10, end - 1)
    expect(almost).toBeGreaterThan(0.9)
    expect(almost).toBeLessThan(1)
  })

  it('no teto da versão fica cheio', () => {
    expect(resolveLevelProgress('fast', CAP, 0)).toBe(1)
  })
})

describe('calculateExperienceGain', () => {
  const base = { baseXp: 64, defeatedLevel: 10 }

  it('vencer quem tem nível mais alto rende mais', () => {
    const weaker = calculateExperienceGain({ ...base, winnerLevel: 20 })
    const even = calculateExperienceGain({ ...base, winnerLevel: 10 })
    const stronger = calculateExperienceGain({ ...base, winnerLevel: 5 })
    expect(stronger).toBeGreaterThan(even)
    expect(even).toBeGreaterThan(weaker)
  })

  it('dividir entre participantes rende menos pra cada um', () => {
    const alone = calculateExperienceGain({ ...base, winnerLevel: 10 })
    const shared = calculateExperienceGain({
      ...base,
      winnerLevel: 10,
      participants: 2,
    })
    expect(shared).toBeLessThan(alone)
  })

  it('sempre dá ao menos 1', () => {
    expect(
      calculateExperienceGain({
        baseXp: 1,
        defeatedLevel: 1,
        winnerLevel: MAX_LEVEL,
      }),
    ).toBeGreaterThanOrEqual(1)
  })

  it('cresce com o XP base da espécie', () => {
    expect(
      calculateExperienceGain({ ...base, baseXp: 200, winnerLevel: 10 }),
    ).toBeGreaterThan(calculateExperienceGain({ ...base, winnerLevel: 10 }))
  })
})
