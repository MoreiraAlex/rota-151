import { afterAll, beforeAll } from 'vitest'
import { listBiomes } from '@/core/data/biomes'

/**
 * Regras de teste para os itens do chão (docs/features/055-itens-no-
 * mundo.md): durante os testes do arquivo, todo bioma com `worldItems` passa
 * a querer item em metade das vezes, com teto maior que um (dá chunk vazio e
 * chunk com vários) — os testes do mecanismo
 * (pegar, repor, carregar) não dependem do quanto a config põe no mundo.
 * Restaura no fim.
 */
export function withTestWorldItemRules() {
  const originals = new Map()
  beforeAll(() => {
    for (const biome of listBiomes()) {
      if (!biome.worldItems) continue
      originals.set(biome, biome.worldItems)
      biome.worldItems = { ...biome.worldItems, chance: 0.5, maxPerChunk: 3 }
    }
  })
  afterAll(() => {
    for (const [biome, rules] of originals) biome.worldItems = rules
    originals.clear()
  })
}
