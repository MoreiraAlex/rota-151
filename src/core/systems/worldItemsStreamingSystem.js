import { TEST_LEVEL } from '../data/testLevel'
import {
  carregarItensDoChunk,
  descarregarItensDoChunk,
} from '../actions/worldItems'
import { Inventory, Position, WorldClock, WorldItemChunks } from '../traits'

/**
 * Os itens do chão seguem os chunks carregados (docs/features/055-itens-no-
 * mundo.md): chunk que carregou ganha as entidades dele (repondo o tempo em
 * que ficou fora, longe do treinador); chunk que descarregou perde as dele.
 * A memória do que o jogador mexeu fica (`WorldItemsMemory`). Só trabalha
 * quando o conjunto de chunks muda (a revisão do relevo,
 * `WorldItemChunks.revision`).
 *
 * Headless. Fase: simulation, depois do `chunkStreamingSystem` (que acabou
 * de carregar e descarregar) e do `worldClockSystem` (a hora deste tick).
 */
export function worldItemsStreamingSystem(context) {
  const { world } = context
  if (!world.has(WorldItemChunks)) return
  const { terrain } = TEST_LEVEL
  const state = world.get(WorldItemChunks)
  const revision = terrain.getRevision()
  if (state.revision === revision) return
  state.revision = revision

  const now = world.get(WorldClock)?.time ?? 0
  const trainer = world.queryFirst(Inventory, Position)
  const avoid = trainer ? trainer.get(Position) : null
  // Pelo objeto do chunk (sem montar chave): só o que entrou ou saiu.
  const chunks = terrain.loadedChunks()
  const current = new Set(chunks)
  const known = new Set()
  for (const [key, chunk] of [...state.loaded]) {
    if (current.has(chunk)) known.add(chunk)
    else descarregarItensDoChunk(world, key)
  }
  for (const chunk of chunks) {
    if (!known.has(chunk)) carregarItensDoChunk(world, chunk, { now, avoid })
  }
}
