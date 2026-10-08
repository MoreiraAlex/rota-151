import { useEffect, useRef } from 'react'
import { POKEBALL_SOUNDS } from '@/core/data/audio/pokeballSounds'
import {
  preloadWorldSounds,
  registerWorldSoundsRoot,
  unregisterWorldSoundsRoot,
} from './worldSounds'

/**
 * O grupo da cena onde moram os sons pontuais (`worldSounds.js`) — e já
 * começa a carregar os da Pokébola (docs/features/043-captura.md).
 */
export function WorldSoundsView() {
  const groupRef = useRef()

  useEffect(() => {
    const group = groupRef.current
    registerWorldSoundsRoot(group)
    preloadWorldSounds(POKEBALL_SOUNDS)
    return () => unregisterWorldSoundsRoot(group)
  }, [])

  return <group ref={groupRef} />
}
