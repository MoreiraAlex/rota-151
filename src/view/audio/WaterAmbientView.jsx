'use client'

import { useEffect, useRef } from 'react'
import {
  registerWaterAmbientRoot,
  unregisterWaterAmbientRoot,
} from './waterAmbient'

/**
 * O grupo da cena onde moram os sons de fundo da água (`waterAmbient.js`,
 * docs/features/065-sons-do-mundo.md, Parte 5). Sem visual.
 */
export function WaterAmbientView() {
  const groupRef = useRef()

  useEffect(() => {
    const group = groupRef.current
    registerWaterAmbientRoot(group)
    return () => unregisterWaterAmbientRoot(group)
  }, [])

  return <group ref={groupRef} />
}
