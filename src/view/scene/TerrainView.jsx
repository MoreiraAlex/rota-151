import { useEffect, useMemo } from 'react'
import { TEST_LEVEL } from '@/core/data/testLevel'
import { GAME_CONFIG } from '@/core/gameConfig'
import { useTerrainChunks } from '@/view/hooks/useTerrainChunks'
import { buildTerrainChunkGeometry } from '@/view/terrain/terrainGeometry'

/**
 * Malha de um chunk do relevo. A geometria nasce aqui (das mesmas alturas
 * do colisor) e é liberada ao desmontar — quando o chunk descarrega (regra
 * 5.3).
 */
function TerrainChunkView({ chunk }) {
  const geometry = useMemo(
    () => buildTerrainChunkGeometry(chunk, GAME_CONFIG.TERRAIN.WATER_LEVEL),
    [chunk],
  )
  useEffect(() => () => geometry.dispose(), [geometry])

  return (
    <mesh geometry={geometry} receiveShadow>
      <meshStandardMaterial vertexColors />
    </mesh>
  )
}

/**
 * O relevo: um mesh por chunk carregado de `TEST_LEVEL.terrain`
 * (docs/features/046-sistema-de-chunks.md) — monta quem carrega e desmonta
 * quem descarrega.
 */
export function TerrainView() {
  useTerrainChunks()
  return TEST_LEVEL.terrain
    .loadedChunks()
    .map((chunk) => (
      <TerrainChunkView key={`${chunk.chunkX},${chunk.chunkZ}`} chunk={chunk} />
    ))
}
