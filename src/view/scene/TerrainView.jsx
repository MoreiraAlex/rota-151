import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { TEST_LEVEL } from '@/core/data/testLevel'
import { GAME_CONFIG } from '@/core/gameConfig'
import { useTerrainChunks } from '@/view/hooks/useTerrainChunks'
import { buildTerrainChunkGeometry } from '@/view/terrain/terrainGeometry'
import {
  TERRAIN_COLOR_MODES,
  getTerrainColorMode,
  subscribeTerrainColorMode,
} from '@/view/terrain/terrainColorMode'
import {
  getTerrainLook,
  subscribeTerrainLook,
} from '@/view/terrain/terrainLook'
import {
  applyTerrainLook,
  createTerrainMaterial,
} from '@/view/terrain/terrainMaterial'

/**
 * Malha de um chunk do relevo. A geometria nasce aqui (das mesmas alturas
 * do colisor) e é liberada ao desmontar — quando o chunk descarrega (regra
 * 5.3).
 */
function TerrainChunkView({ chunk, colorMode, material }) {
  const geometry = useMemo(
    () =>
      buildTerrainChunkGeometry(
        chunk,
        GAME_CONFIG.TERRAIN.WATER_LEVEL,
        colorMode,
      ),
    [chunk, colorMode],
  )
  useEffect(() => () => geometry.dispose(), [geometry])

  return <mesh geometry={geometry} material={material} receiveShadow />
}

/**
 * O relevo: um mesh por chunk carregado de `TEST_LEVEL.terrain`
 * (docs/features/046-sistema-de-chunks.md) — monta quem carrega e desmonta
 * quem descarrega. As cores seguem o modo do debug (`terrainColorMode.js`)
 * e o teste de visual do chão (`terrainLook.js`), num material só para
 * todos os chunks.
 */
export function TerrainView() {
  useTerrainChunks()
  const colorMode = useSyncExternalStore(
    subscribeTerrainColorMode,
    getTerrainColorMode,
    getTerrainColorMode,
  )
  const [material] = useState(createTerrainMaterial)
  useEffect(() => () => material.dispose(), [material])
  useEffect(() => {
    const apply = () =>
      applyTerrainLook(
        material,
        getTerrainLook(),
        colorMode === TERRAIN_COLOR_MODES.natural,
      )
    apply()
    return subscribeTerrainLook(apply)
  }, [material, colorMode])
  return TEST_LEVEL.terrain
    .loadedChunks()
    .map((chunk) => (
      <TerrainChunkView
        key={`${chunk.chunkX},${chunk.chunkZ}`}
        chunk={chunk}
        colorMode={colorMode}
        material={material}
      />
    ))
}
