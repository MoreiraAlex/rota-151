import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import { GAME_CONFIG } from '@/core/gameConfig'
import { nextDrawnFrame } from './frameLimit'

/**
 * Limite de quadros por segundo (`GAME_CONFIG.RENDER.MAX_FPS`, 0 = o da
 * tela). O `<Canvas>` fica com `frameloop="never"` e este componente é quem
 * manda desenhar (`advance` do R3F): a cada quadro da tela, desenha só se
 * já passou o intervalo do limite (`nextDrawnFrame`). Lê o config a cada
 * quadro, então trocar no F2 vale na hora.
 *
 * O tempo passado ao `advance` (s) continua o relógio do R3F — o `delta`
 * dos `useFrame` sai dele; um tempo absoluto daria um primeiro `delta`
 * enorme, e recomeçar do zero (remontagem) daria um negativo.
 */
export function FrameLimiter() {
  const advance = useThree((state) => state.advance)
  const get = useThree((state) => state.get)

  useEffect(() => {
    let request = 0
    let start = null
    let last = null
    const tick = (now) => {
      request = requestAnimationFrame(tick)
      start ??= now - get().clock.elapsedTime * 1000
      const next = nextDrawnFrame(now, last, GAME_CONFIG.RENDER.MAX_FPS)
      if (next === null) return
      last = next
      advance((now - start) / 1000)
    }
    request = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(request)
  }, [advance, get])

  return null
}
