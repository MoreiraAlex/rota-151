import { describe, expect, it } from 'vitest'
import { listSpecies } from '@/core/data/species'
import { MAX_MASTERY, listLearnset } from '@/core/data/species/moves'
import { GAME_CONFIG } from '@/core/gameConfig'
import { resolveMaxStamina } from '@/core/traits'
import { resolveAttackForEntity } from './attackCasting'
import { TRAINING_SLOT } from './creatureAttack'
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

// Teto do custo (docs/features/067-campo-de-treino-e-avisos-de-nivel.md):
// golpe caro com domínio baixo não pode ficar impossível de usar.
describe('resolveAttackForEntity — custo de energia', () => {
  it('nenhum golpe custa mais que a energia máxima, em nenhum nível ou domínio', () => {
    const { MAX_LEVEL } = GAME_CONFIG.EXPERIENCE
    for (const species of listSpecies()) {
      for (const entry of listLearnset(species)) {
        for (const level of [1, Math.ceil(MAX_LEVEL / 2), MAX_LEVEL]) {
          const maxStamina = resolveMaxStamina(species, {}, level)
          for (const mastery of [0, MAX_MASTERY]) {
            const attack = resolveAttackForEntity(
              species,
              TRAINING_SLOT,
              {},
              level,
              { [TRAINING_SLOT]: { id: entry.id, mastery } },
            )
            if (!attack) continue
            expect(
              attack.staminaCost,
              `${species.id} ${entry.id} Nv.${level}`,
            ).toBeLessThanOrEqual(maxStamina + 1e-9)
          }
        }
      }
    }
  })
})
