import { useEffect, useMemo, useState } from 'react'
import { TEST_LEVEL } from '@/core/data/testLevel'
import { GAME_CONFIG } from '@/core/gameConfig'
import { useTerrainChunks } from '@/view/hooks/useTerrainChunks'
import { buildTerrainChunkGeometry } from '@/view/terrain/terrainGeometry'
import {
  applyTerrainLook,
  createTerrainMaterial,
} from '@/view/terrain/terrainMaterial'

/**
 * Malha de um chunk do relevo. A geometria nasce aqui (das mesmas alturas
 * do colisor) e é liberada ao desmontar — quando o chunk descarrega (regra
 * 5.3).
 */
function TerrainChunkView({ chunk, material }) {
  const geometry = useMemo(
    () => buildTerrainChunkGeometry(chunk, GAME_CONFIG.TERRAIN.WATER_LEVEL),
    [chunk],
  )
  useEffect(() => () => geometry.dispose(), [geometry])

  return <mesh geometry={geometry} material={material} receiveShadow />
}

/**
 * O relevo: um mesh por chunk carregado de `TEST_LEVEL.terrain`
 * (docs/features/046-sistema-de-chunks.md) — monta quem carrega e desmonta
 * quem descarrega. Um material só para todos os chunks, com o desenho do
 * chão de `GAME_CONFIG.TERRAIN_LOOK`.
 */
export function TerrainView() {
  useTerrainChunks()
  const [material] = useState(() => {
    const created = createTerrainMaterial()
    applyTerrainLook(created, GAME_CONFIG.TERRAIN_LOOK)
    return created
  })
  useEffect(() => () => material.dispose(), [material])
  return TEST_LEVEL.terrain
    .loadedChunks()
    .map((chunk) => (
      <TerrainChunkView
        key={`${chunk.chunkX},${chunk.chunkZ}`}
        chunk={chunk}
        material={material}
      />
    ))
}
