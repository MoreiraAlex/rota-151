import { TEST_LEVEL } from '../data/testLevel'
import { congelarPorChunk, descongelarPorChunk } from '../actions/chunks'
import { CharacterController, ChunkFrozen, Position } from '../traits'

/**
 * Congela o personagem cujo chunk não está carregado e descongela quando o
 * chunk volta (`ChunkFrozen`, docs/features/046-sistema-de-chunks.md). O
 * treinador e a criatura controlada nunca congelam na prática: o chão em
 * volta deles carrega na hora (`chunkStreamingSystem`, que roda antes).
 *
 * Headless. Fase: simulation, logo depois do `chunkStreamingSystem` e antes
 * das IAs e do `characterPhysicsSystem`.
 */
export function chunkFreezeSystem(context) {
  const { world } = context
  const { terrain } = TEST_LEVEL

  const toFreeze = []
  const toThaw = []
  world.query(CharacterController, Position).forEach((entity) => {
    const { x, z } = entity.get(Position)
    const isLoaded = terrain.isLoadedAt(x, z)
    const isFrozen = entity.has(ChunkFrozen)
    if (!isLoaded && !isFrozen) toFreeze.push(entity)
    else if (isLoaded && isFrozen) toThaw.push(entity)
  })

  // Fora da iteração: mudar tag no meio da query mexe nela.
  for (const entity of toFreeze) congelarPorChunk(entity)
  for (const entity of toThaw) descongelarPorChunk(entity)
}
