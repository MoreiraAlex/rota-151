import { TEST_LEVEL } from '../data/testLevel'
import { GAME_CONFIG } from '../gameConfig'
import { createWeatherSampler } from './weatherMap'

// Sorteador do mundo do jogo, criado na primeira consulta. Refeito se a seed
// mudar (painel de ajuste do relevo, F2).
let sampler = null
let samplerSeed = null

/**
 * Clima do mundo do jogo em `(x, z)` no horário `time` (dias de jogo):
 * `{ type, intensity }` (docs/features/048-dia-noite-e-clima.md). Usa a
 * seed do mundo e o bioma do relevo do nível. É a consulta do spawn (053)
 * e do `weatherSystem`.
 */
export function weatherAt(x, z, time) {
  const seed = GAME_CONFIG.WORLD.SEED
  if (!sampler || samplerSeed !== seed) {
    sampler = createWeatherSampler(seed, (bx, bz) =>
      TEST_LEVEL.terrain.biomeAt(bx, bz),
    )
    samplerSeed = seed
  }
  return sampler.weatherAt(x, z, time)
}
