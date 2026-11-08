import { describe, expect, it } from 'vitest'
import {
  DAY_PHASE_NAMES,
  describeSpawnConditions,
  formatHour,
  formatSpawnFactor,
} from './wikiFormat'

// Textos do spawn na wiki (docs/features/062-spawn-estilo-cobblemon.md).
// Números só de teste.

describe('formatSpawnFactor', () => {
  it('zero não aparece; acima de um é mais chance; abaixo, menos', () => {
    expect(formatSpawnFactor(0)).toBe('não aparece')
    expect(formatSpawnFactor(2)).toContain('mais chance')
    expect(formatSpawnFactor(0.5)).toContain('metade')
    expect(formatSpawnFactor(0.25)).toContain('da chance')
  })
})

describe('describeSpawnConditions', () => {
  it('sem condição, o texto padrão; com condições, uma por parte', () => {
    expect(describeSpawnConditions([], DAY_PHASE_NAMES, 'sempre')).toBe(
      'sempre',
    )
    const text = describeSpawnConditions(
      [
        { key: 'night', factor: 0 },
        { key: 'day', factor: 2 },
      ],
      DAY_PHASE_NAMES,
      'sempre',
    )
    expect(text).toContain(`${DAY_PHASE_NAMES.night}: não aparece`)
    expect(text).toContain(DAY_PHASE_NAMES.day)
  })
})

describe('formatHour', () => {
  it('hora cheia e hora quebrada', () => {
    expect(formatHour(5)).toBe('5h')
    expect(formatHour(7.5)).toBe('7h30')
  })
})
