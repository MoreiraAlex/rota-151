'use client'

import { useEffect, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { useTrait } from 'koota/react'
import { aspectRatioOf, canvasSizeOf } from '@/core/actions'
import { GraphicsSettings } from '@/core/traits'
import { playerEntity } from '@/core/world/world'

/**
 * O `<Canvas>` do jogo (e do lab de biomas), do tamanho escolhido no menu
 * "Gráficos" (`GraphicsSettings.aspect`/`canvasScale`, docs/features/066-
 * revisao-dos-biomas.md): o canvas fica no centro de quem o monta, na
 * proporção e no tamanho escolhidos (`canvasSizeOf`), com preto em volta.
 *
 * O desenho é sempre um pixel por pixel do canvas (`dpr` fixo como prop:
 * o R3F reaplica a prop do Canvas a cada render de quem o monta, então
 * mudar a densidade por fora seria desfeito). Mede o espaço com um
 * `ResizeObserver` — redimensionar a janela reencaixa; até a primeira
 * medida, ocupa tudo.
 *
 * Ocupa o pai inteiro (que precisa ser posicionado) e fica dentro do
 * `WorldProvider` (lê o trait).
 */
export function GameCanvas({ children, ...props }) {
  const graphics = useTrait(playerEntity, GraphicsSettings)
  const spaceRef = useRef(null)
  const [space, setSpace] = useState(null)

  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      setSpace({ width, height })
    })
    observer.observe(spaceRef.current)
    return () => observer.disconnect()
  }, [])

  const size =
    space &&
    canvasSizeOf(
      space.width,
      space.height,
      aspectRatioOf(graphics?.aspect),
      graphics?.canvasScale,
    )

  return (
    <div
      ref={spaceRef}
      className="absolute inset-0 flex items-center justify-center bg-black"
    >
      <div
        className="relative shrink-0"
        style={size ?? { width: '100%', height: '100%' }}
      >
        {/* Stencil ligado: os personagens marcam onde aparecem e o aviso de
            golpe não desenha por cima deles (materials/characterStencil.js). */}
        <Canvas {...props} gl={{ ...props.gl, stencil: true }} dpr={1}>
          {children}
        </Canvas>
      </div>
    </div>
  )
}
