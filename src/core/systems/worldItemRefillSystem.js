import { criarItemNoChao, verificarTetoDoChunk } from '../actions/worldItems'
import { GAME_CONFIG } from '../gameConfig'
import {
  Inventory,
  Position,
  WorldClock,
  WorldItemChunks,
  WorldItemsMemory,
} from '../traits'
import { chunkItemRulesOf, refillIntervalDays } from '../worldItems/worldItems'

/**
 * Reposição dos itens do chão (docs/features/055-itens-no-mundo.md): num
 * chunk carregado e abaixo do teto do bioma, a cada `refillMinutes` de jogo
 * uma verificação sorteia quantos itens ele quer ter (de nenhum até o teto)
 * e completa o que faltar, em pontos livres longe do treinador
 * (`verificarTetoDoChunk`). O tempo conta da última verificação — a da
 * memória (`lastRefill`) ou, no chunk que ninguém mexeu, a desde que ele
 * carregou (`WorldItemChunks.checkedAt`).
 *
 * Confere os chunks de `REFILL_CHECK_SECONDS` em `REFILL_CHECK_SECONDS`
 * (o tempo da reposição é de minutos de jogo), não a cada passo.
 *
 * Headless. Fase: simulation, depois do `worldItemsStreamingSystem` e do
 * `worldClockSystem`.
 */
export function worldItemRefillSystem(context) {
  const { world, delta = 0 } = context
  if (!world.has(WorldItemsMemory) || !world.has(WorldItemChunks)) return
  const state = world.get(WorldItemChunks)
  state.refillTimer -= delta
  if (state.refillTimer > 0) return
  state.refillTimer = GAME_CONFIG.WORLD_ITEMS.REFILL_CHECK_SECONDS

  const now = world.get(WorldClock)?.time ?? 0
  const { chunks } = world.get(WorldItemsMemory)
  const { loaded, checkedAt } = state
  const trainer = world.queryFirst(Inventory, Position)
  const avoid = trainer ? trainer.get(Position) : null

  for (const [key, chunk] of loaded) {
    const rules = chunkItemRulesOf(chunk)
    if (!rules) continue
    const entry = chunks[key]
    if (entry && entry.items.length >= rules.maxPerChunk) continue
    const lastCheck = entry ? entry.lastRefill : (checkedAt.get(key) ?? now)
    if (now - lastCheck < refillIntervalDays(rules)) continue

    for (const item of verificarTetoDoChunk(world, chunk, { avoid })) {
      criarItemNoChao(world, key, item)
    }
  }
}
