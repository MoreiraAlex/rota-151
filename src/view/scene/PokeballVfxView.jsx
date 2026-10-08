import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'
import { GAME_CONFIG } from '@/core/gameConfig'
import { createParticleSystem } from '@/view/vfx/particleEmitter'
import {
  CAPTURE_TEXTURE_PATHS,
  buildCaptureEmitters,
  buildSendOutEmitters,
  listPokeballVfxTexturePaths,
  resolveSendOutProfile,
  resolveSendOutTexturePaths,
} from '@/view/vfx/pokeballVfx'
import { drainPokeballVfx } from '@/view/vfx/pokeballVfxQueue'

const TEXTURE_PATHS = listPokeballVfxTexturePaths()
// Passo máximo da simulação — um frame longo não vira um salto.
const MAX_STEP = 1 / 20

/**
 * Partículas da Pokébola (docs/features/043-captura.md, `pokeballVfx.js`):
 * drena os pedidos (`pokeballVfxQueue.js`) e solta uma rajada por pedido —
 * a bola abrindo (`'sendOut'`, com as texturas e cores da bola) ou o
 * "Capturado!" (`'capture'`). `GAME_CONFIG.FEEDBACK.POKEBALL_VFX`: liga/
 * desliga e a escala.
 *
 * `useFrame` aqui é a exceção documentada de componente puramente visual,
 * igual ao `EatingVfxView.jsx`.
 */
export function PokeballVfxView() {
  const loaded = useTexture(TEXTURE_PATHS)
  const rootRef = useRef()
  const bursts = useRef(new Set())

  useEffect(() => {
    const root = rootRef.current
    const set = bursts.current
    return () => {
      for (const system of set) {
        root?.remove(system.group)
        system.dispose()
      }
      set.clear()
    }
  }, [])

  useFrame((_state, delta) => {
    const root = rootRef.current
    const requests = drainPokeballVfx()
    if (!root) return
    const config = GAME_CONFIG.FEEDBACK.POKEBALL_VFX
    if (config.ENABLED) {
      for (const request of requests) spawn(root, request, config.SCALE)
    }
    const step = Math.min(delta, MAX_STEP)
    for (const system of [...bursts.current]) {
      system.update(step)
      if (!system.isDone()) continue
      root.remove(system.group)
      system.dispose()
      bursts.current.delete(system)
    }
  })

  function spawn(root, { kind, itemId, position }, scale) {
    const paths =
      kind === 'capture'
        ? CAPTURE_TEXTURE_PATHS
        : resolveSendOutTexturePaths(itemId)
    const textures = Object.fromEntries(
      Object.entries(paths).map(([key, path]) => [
        key,
        loaded[TEXTURE_PATHS.indexOf(path)],
      ]),
    )
    const emitters =
      kind === 'capture'
        ? buildCaptureEmitters()
        : buildSendOutEmitters(resolveSendOutProfile(itemId))
    const system = createParticleSystem({
      emitters,
      textures,
      length: 0,
      radius: 0,
      scale,
    })
    system.group.position.set(position.x, position.y, position.z)
    root.add(system.group)
    bursts.current.add(system)
  }

  return <group ref={rootRef} />
}

useTexture.preload(TEXTURE_PATHS)
