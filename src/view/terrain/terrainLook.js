import { GAME_CONFIG } from '@/core/gameConfig'

/**
 * Os números do desenho do chão (`GAME_CONFIG.TERRAIN_LOOK`,
 * docs/features/047-biomas.md): o painel do debug mexe ao vivo e avisa por
 * `notifyTerrainLookChanged`; quem aplica no material é o `TerrainView`
 * (`applyTerrainLook`, terrainMaterial.js).
 */
export const getTerrainLook = () => GAME_CONFIG.TERRAIN_LOOK

const listeners = new Set()

export function notifyTerrainLookChanged() {
  for (const listener of listeners) listener()
}

export function subscribeTerrainLook(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
