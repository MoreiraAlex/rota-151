import { useEffect, useMemo, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { TEST_LEVEL } from '@/core/data/testLevel'
import { GAME_CONFIG } from '@/core/gameConfig'
import { useTerrainChunks } from '@/view/hooks/useTerrainChunks'
import { buildTerrainChunkGeometry } from '@/view/terrain/terrainGeometry'
import {
  applyTerrainLook,
  createTerrainMaterials,
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
 * quem descarrega. Um material só para todos os chunks, o da luz do chão
 * (`TERRAIN_LOOK.LIGHTING`), com o desenho de `GAME_CONFIG.TERRAIN_LOOK`.
 */
export function TerrainView() {
  useTerrainChunks()
  const [terrain] = useState(() => {
    const created = createTerrainMaterials()
    applyTerrainLook(created, GAME_CONFIG.TERRAIN_LOOK)
    return created
  })
  useEffect(() => () => terrain.dispose(), [terrain])
  const [lighting, setLighting] = useState(GAME_CONFIG.TERRAIN_LOOK.LIGHTING)
  // O desenho do chão e a luz ao vivo (mexem no lab de biomas). `useFrame`
  // só visual, exceção das regras (3.4).
  useFrame(() => {
    const look = GAME_CONFIG.TERRAIN_LOOK
    applyTerrainLook(terrain, look)
    if (look.LIGHTING !== lighting) setLighting(look.LIGHTING)
  })
  const material = terrain.forLighting(lighting)
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
