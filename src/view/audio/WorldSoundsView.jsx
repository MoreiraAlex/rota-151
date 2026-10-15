import { useEffect, useRef } from 'react'
import { POKEBALL_SOUNDS } from '@/core/data/audio/pokeballSounds'
import { WORLD_ITEM_SOUNDS } from '@/core/data/audio/worldItemSounds'
import {
  preloadWorldSounds,
  registerWorldSoundsRoot,
  unregisterWorldSoundsRoot,
} from './worldSounds'

/**
 * O grupo da cena onde moram os sons pontuais (`worldSounds.js`) — e já
 * começa a carregar os da Pokébola (docs/features/043-captura.md) e os dos
 * itens no mundo (docs/features/055-itens-no-mundo.md).
 */
export function WorldSoundsView() {
  const groupRef = useRef()

  useEffect(() => {
    const group = groupRef.current
    registerWorldSoundsRoot(group)
    preloadWorldSounds(POKEBALL_SOUNDS)
    preloadWorldSounds(WORLD_ITEM_SOUNDS)
    return () => unregisterWorldSoundsRoot(group)
  }, [])

  return <group ref={groupRef} />
}
