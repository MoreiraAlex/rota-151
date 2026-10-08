import { useSyncExternalStore } from 'react'
import { TEST_LEVEL } from '@/core/data/testLevel'

const subscribe = (listener) => TEST_LEVEL.terrain.subscribe(listener)
const getRevision = () => TEST_LEVEL.terrain.getRevision()

/**
 * Re-renderiza quem desenha o relevo quando um chunk carrega ou descarrega
 * (docs/features/046-sistema-de-chunks.md). Devolve o número da revisão do
 * conjunto de chunks.
 */
export function useTerrainChunks() {
  return useSyncExternalStore(subscribe, getRevision, getRevision)
}
