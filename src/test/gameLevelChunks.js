import { carregarChunk, descarregarTodosOsChunks } from '@/core/actions/chunks'
import { createStaticLevel } from '@/core/physics/colliders'

/**
 * Monta o nível do jogo para um teste de física: o chunk da origem
 * carregado (o mundo começa sem nenhum — quem carrega é o
 * `chunkStreamingSystem`, docs/features/046-sistema-de-chunks.md) e os
 * colliders estáticos. Chamar depois do `initPhysics()`; desfazer com
 * `clearGameLevelChunks()` no `afterEach`.
 */
export function buildGameLevelAtOrigin() {
  carregarChunk(0, 0)
  createStaticLevel()
}

/** Descarrega os chunks que um teste carregou. */
export function clearGameLevelChunks() {
  descarregarTodosOsChunks()
}
