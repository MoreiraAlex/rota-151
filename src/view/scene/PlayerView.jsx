import { useEffect, useRef } from 'react'

import { playerEntity } from '@/core/world/world'
import { GAME_CONFIG } from '@/core/gameConfig'
import { registerView, unregisterView } from '../registry/viewRegistry'

const { CAPSULE_RADIUS, CAPSULE_HALF_HEIGHT } = GAME_CONFIG.PHYSICS.CHARACTER

/**
 * Wrapper fino: renderiza a cápsula do jogador (mesmas dimensões do collider) e
 * registra a ref de cena para o syncTransformSystem. Sem lógica, sem useFrame.
 */
export function PlayerView() {
  const meshRef = useRef()

  useEffect(() => {
    registerView(playerEntity, meshRef.current)
    return () => unregisterView(playerEntity)
  }, [])

  return (
    <mesh ref={meshRef} castShadow>
      <capsuleGeometry
        args={[CAPSULE_RADIUS, CAPSULE_HALF_HEIGHT * 2, 8, 16]}
      />
      <meshStandardMaterial color="red" />
    </mesh>
  )
}
