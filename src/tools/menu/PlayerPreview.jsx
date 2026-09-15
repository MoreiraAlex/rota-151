'use client'

import { useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { getSpecies, PLAYER_SPECIES_ID } from '@/core/data/species'

const PLAYER_SPECIES = getSpecies(PLAYER_SPECIES_ID)

/**
 * Modelo do jogador na pose de descanso do próprio `.glb` (sem clipe
 * procedural nenhum aplicado), girando devagar — só decorativo. De
 * propósito **não** usa `useAnimatedModel`/`registerView`: aquele
 * mecanismo é um registro único por entidade (ver
 * `view/registry/viewRegistry.js`), e `playerEntity` já está registrado
 * de verdade por `PlayerView.jsx` — reaproveitar aqui tomaria o lugar
 * desse registro e quebraria a sincronização de posição da cena real.
 * Este preview vive no próprio canvas, sem ligação nenhuma com o loop do
 * jogo.
 */
function SpinningModel() {
  const groupRef = useRef()
  const { scene } = useGLTF(PLAYER_SPECIES.model.path)
  const cloned = useMemo(() => cloneSkeleton(scene), [scene])

  useFrame((_, delta) => {
    if (groupRef.current) groupRef.current.rotation.y += delta * 0.6
  })

  return (
    <group ref={groupRef}>
      <primitive
        object={cloned}
        scale={PLAYER_SPECIES.model.scale}
        position={PLAYER_SPECIES.body.modelOffset}
      />
    </group>
  )
}

/**
 * Preview isolado do modelo do jogador, num canvas próprio — ver
 * docs/features/018-preview-de-equipamento-no-inventario.md. Usado no
 * inventário pra mostrar em tempo real onde vai o que for equipado (os
 * slots ficam ao redor, ver `InventoryPanel.jsx`).
 */
export function PlayerPreview() {
  return (
    <div className="h-40 w-full overflow-hidden rounded border border-white/10 bg-black/40">
      <Canvas camera={{ position: [0, 1.1, 3], fov: 35 }}>
        <ambientLight intensity={0.8} />
        <directionalLight position={[2, 4, 2]} intensity={1} />
        <SpinningModel />
      </Canvas>
    </div>
  )
}
