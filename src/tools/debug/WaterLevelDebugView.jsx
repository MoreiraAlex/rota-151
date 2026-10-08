'use client'

import { TEST_LEVEL } from '@/core/data/testLevel'
import { GAME_CONFIG } from '@/core/gameConfig'
import { useLevelRevision } from '@/view/hooks/useLevelRevision'

/**
 * Debug (F2, montado por `src/app/(auth)/page.js`): plano translúcido no
 * nível da água (`GAME_CONFIG.TERRAIN.WATER_LEVEL`) cobrindo a área do
 * nível — mostra onde vão ficar os lagos antes da água existir (048).
 * Ver docs/features/045-terreno-de-um-chunk.md.
 */
export function WaterLevelDebugView() {
  useLevelRevision()
  const { minX, maxX, minZ, maxZ } = TEST_LEVEL.bounds

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
