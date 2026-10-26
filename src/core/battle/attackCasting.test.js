import { describe, expect, it } from 'vitest'
import { listSpecies } from '@/core/data/species'
import { resolveAttackForEntity } from './attackCasting'
import { speedStageTimeFactor } from './statStages'

// A primeira espécie com golpe no primeiro slot, com IV qualquer.
function anyAttacker() {
  for (const species of listSpecies()) {
    if (resolveAttackForEntity(species, 'secondary1', {})) return species
  }
  return null
}

describe('resolveAttackForEntity — estágio de Velocidade', () => {
  it('baixa: o golpe demora mais pelo fator do estágio; custo e recarga iguais', () => {
    const species = anyAttacker()
    const normal = resolveAttackForEntity(species, 'secondary1', {})
    for (const stage of [-2, 2]) {
      const staged = resolveAttackForEntity(
        species,
        'secondary1',
        {},
        undefined,
        null,
        stage,
      )
      const factor = speedStageTimeFactor(stage)
      expect(staged.duration).toBeCloseTo(normal.duration * factor)
      expect(staged.effectAt).toBeCloseTo(normal.effectAt * factor)
      expect(staged.staminaCost).toBeCloseTo(normal.staminaCost)
      expect(staged.cooldown).toBeCloseTo(normal.cooldown)
    }
  })
})
