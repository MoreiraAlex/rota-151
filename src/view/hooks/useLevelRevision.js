import { useSyncExternalStore } from 'react'
import { getLevelRevision, subscribeLevelChanges } from '@/core/data/testLevel'

/**
 * Re-renderiza quem desenha o nível quando o relevo é refeito (ajuste em
 * tempo real, `regenerarTerreno`). Devolve o número da revisão.
 */
export function useLevelRevision() {
  return useSyncExternalStore(
    subscribeLevelChanges,
    getLevelRevision,
    getLevelRevision,
  )
}
