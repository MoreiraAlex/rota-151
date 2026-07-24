import { useEffect, useRef } from 'react'

import { cubeEntity } from '@/core/world/world'
import { registerView, unregisterView } from '../registry/viewRegistry'
import { Box } from '@react-three/drei'

export function CubeView() {
  const meshRef = useRef()

  useEffect(() => {
    registerView(cubeEntity, meshRef.current)

    return () => unregisterView(cubeEntity)
  }, [])

  return (
    <mesh ref={meshRef}>
      <Box material-color="red" />
    </mesh>
  )
}
