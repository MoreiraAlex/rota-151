import { useEffect, useRef } from 'react'

import { playerEntity } from '@/core/world/world'
import { registerView, unregisterView } from '../registry/viewRegistry'

/**
 * Wrapper fino: renderiza o corpo placeholder do jogador e registra a ref de
 * cena para o syncTransformSystem. Sem lógica de jogo, sem useFrame.
 */
export function PlayerView() {
  const meshRef = useRef()

  useEffect(() => {
    registerView(playerEntity, meshRef.current)
    return () => unregisterView(playerEntity)
  }, [])

  return (
    <mesh ref={meshRef} castShadow>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="red" />
    </mesh>
  )
}
