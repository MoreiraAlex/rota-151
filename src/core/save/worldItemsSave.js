import { descarregarItensDoChunk } from '../actions/worldItems'
import { getItem } from '../data/items'
import { WorldItemChunks, WorldItemsMemory } from '../traits'

/**
 * Os itens do mundo no save (docs/features/055-itens-no-mundo.md): a
 * memória do que o jogador mexeu (`WorldItemsMemory`) — os chunks mexidos e
 * os arbustos e árvores colhidos hoje. O resto sai da seed de novo.
 */

/** A memória dos itens do mundo, em cópia (o save não divide objeto). */
export function serializeWorldItems(world) {
  const memory = world.has(WorldItemsMemory)
    ? world.get(WorldItemsMemory)
    : { chunks: {}, foraged: {} }
  return structuredClone({ chunks: memory.chunks, foraged: memory.foraged })
}

/**
 * Devolve a memória salva ao mundo. Item que não existe mais no catálogo
 * fica de fora. As entidades que já nasceram (da seed, antes do save
 * chegar) saem: o streaming cria de novo, agora com a memória.
 */
export function restoreWorldItems(world, saved) {
  const chunks = {}
  for (const [key, entry] of Object.entries(saved?.chunks ?? {})) {
    chunks[key] = {
      ...entry,
      items: entry.items.filter((item) => getItem(item.itemId)),
    }
  }
  world.set(WorldItemsMemory, {
    chunks: structuredClone(chunks),
    foraged: { ...(saved?.foraged ?? {}) },
  })
  if (!world.has(WorldItemChunks)) return
  const state = world.get(WorldItemChunks)
  for (const key of [...state.loaded.keys()]) {
    descarregarItensDoChunk(world, key)
  }
  // O streaming refaz no próximo passo, mesmo sem chunk novo.
  state.revision = -1
}
