import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { GAME_CONFIG } from '@/core/gameConfig'
import {
  registerCaptureAimView,
  unregisterCaptureAimView,
} from '../registry/captureAimRegistry'

const { ARC_POINTS } = GAME_CONFIG.CAPTURE.AIM
// Raio (m) de cada pontinho do arco.
const DOT_RADIUS = 0.025

/**
 * O arco da mira da Pokébola (docs/features/043-captura.md, modo `'arc'`):
 * uma fileira de pontinhos ao longo do voo previsto e um círculo no chão
 * onde a bola bate (em volta do selvagem, se ela pega um). Quem posiciona e
 * colore é o `captureAimViewSystem.js`; começa escondido.
 */
export function CaptureAimView() {
  const dotsRef = useRef()
  const ringRef = useRef()

  useEffect(() => {
    registerCaptureAimView({ dots: dotsRef.current, ring: ringRef.current })
    return () => unregisterCaptureAimView()
  }, [])

  return (
    <>
      <instancedMesh
        ref={dotsRef}
        args={[null, null, ARC_POINTS]}
        visible={false}
        frustumCulled={false}
      >
        <sphereGeometry args={[DOT_RADIUS, 8, 6]} />
        <meshBasicMaterial transparent opacity={0.85} toneMapped={false} />
      </instancedMesh>
      <mesh ref={ringRef} visible={false} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.85, 1, 40]} />
        <meshBasicMaterial
          transparent
          opacity={0.9}
          side={THREE.DoubleSide}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    </>
  )
}
