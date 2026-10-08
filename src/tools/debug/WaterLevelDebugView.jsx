'use client'

import { TEST_LEVEL } from '@/core/data/testLevel'
import { GAME_CONFIG } from '@/core/gameConfig'
import { useTerrainChunks } from '@/view/hooks/useTerrainChunks'

/**
 * Debug (F2, montado por `src/app/(auth)/page.js`): plano translúcido no
 * nível da água (`GAME_CONFIG.TERRAIN.WATER_LEVEL`) cobrindo os chunks
 * carregados — mostra onde vão ficar os lagos antes da água existir (048).
 * Ver docs/features/045-terreno-de-um-chunk.md.
 */
export function WaterLevelDebugView() {
  useTerrainChunks()
  const chunks = TEST_LEVEL.terrain.loadedChunks()
  if (chunks.length === 0) return null

  const minX = Math.min(...chunks.map((chunk) => chunk.minX))
  const minZ = Math.min(...chunks.map((chunk) => chunk.minZ))
  const maxX = Math.max(...chunks.map((chunk) => chunk.minX + chunk.size))
  const maxZ = Math.max(...chunks.map((chunk) => chunk.minZ + chunk.size))

  return (
    <mesh
      position={[
        (minX + maxX) / 2,
        GAME_CONFIG.TERRAIN.WATER_LEVEL,
        (minZ + maxZ) / 2,
      ]}
      rotation={[-Math.PI / 2, 0, 0]}
    >
      <planeGeometry args={[maxX - minX, maxZ - minZ]} />
      <meshBasicMaterial
        color="#2f7fd8"
        transparent
        opacity={0.45}
        depthWrite={false}
      />
    </mesh>
  )
}
