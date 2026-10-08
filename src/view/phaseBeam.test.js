import { describe, it, expect } from 'vitest'
import { GAME_CONFIG } from '@/core/gameConfig'
import { listItems } from '@/core/data/items'
import { resolveBeamColor, resolveBeamPhase } from './phaseBeam'

describe('feixe da Pokébola', () => {
  it('entrando: o envelope encolhe e vai até a bola; saindo: cresce no lugar', () => {
    const start = resolveBeamPhase('recall', 0)
    const end = resolveBeamPhase('recall', 1)
    expect(start).toMatchObject({
      envelopeScale: 1,
      envelopeTravel: 0,
      fade: 1,
    })
    expect(end).toMatchObject({ envelopeScale: 0, envelopeTravel: 1, fade: 0 })
    expect(resolveBeamPhase('capture', 0.5)).toEqual(
      resolveBeamPhase('recall', 0.5),
    )

    expect(resolveBeamPhase('sendOut', 0).envelopeScale).toBe(0)
    expect(resolveBeamPhase('sendOut', 0.5).envelopeScale).toBe(1)
    expect(resolveBeamPhase('sendOut', 0.5).envelopeTravel).toBe(0)
  })

  it('cor da bola, ou a padrão', () => {
    for (const item of listItems().filter((i) => i.category === 'pokeball')) {
      expect(resolveBeamColor(item.id)).toBe(
        item.pokeball.beamColor ??
          GAME_CONFIG.FEEDBACK.PHASE_BEAM.DEFAULT_COLOR,
      )
    }
    expect(resolveBeamColor('nao-existe')).toBe(
      GAME_CONFIG.FEEDBACK.PHASE_BEAM.DEFAULT_COLOR,
    )
  })
})
