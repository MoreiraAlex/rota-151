import { useEffect, useMemo } from 'react'
import { TEST_LEVEL } from '@/core/data/testLevel'
import { GAME_CONFIG } from '@/core/gameConfig'
import { buildTerrainChunkGeometry } from '@/view/terrain/terrainGeometry'

/**
 * Malha de um chunk do relevo. A geometria nasce aqui (das mesmas alturas
 * do colisor) e é liberada ao desmontar (regra 5.3).
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
 * O relevo do nível: um mesh por chunk de `TEST_LEVEL.terrain`
 * (docs/features/045-terreno-de-um-chunk.md).
 */
export function TerrainView() {
  return TEST_LEVEL.terrain.chunks.map((chunk) => (
    <TerrainChunkView key={`${chunk.chunkX},${chunk.chunkZ}`} chunk={chunk} />
  ))
}
