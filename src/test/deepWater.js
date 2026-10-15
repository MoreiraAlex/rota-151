import { TEST_LEVEL } from '@/core/data/testLevel'
import { GAME_CONFIG } from '@/core/gameConfig'

// Mais funda que a navegação e que o limite de qualquer corpo.
const DEPTH = 10

/**
 * Roda `run` com o mundo todo debaixo de água funda
 * (docs/features/057-lagos-e-rios.md): o relevo do nível
 * (`TEST_LEVEL.terrain.heightAt`) fica bem abaixo do nível da água e volta
 * ao fim.
 */
export function withDeepWater(run) {
  const { terrain } = TEST_LEVEL
  const original = terrain.heightAt
  const { WATER_LEVEL } = GAME_CONFIG.TERRAIN
  terrain.heightAt = () => WATER_LEVEL - DEPTH
  try {
    return run()
  } finally {
    terrain.heightAt = original
  }
}
