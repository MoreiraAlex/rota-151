'use client'

import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { setRenderStats } from './renderStats'

// Segundos entre uma leitura e outra (o painel não precisa de mais).
const INTERVAL = 0.5

/**
 * Debug (F2): lê do renderer quantas chamadas de desenho e triângulos o
 * último quadro custou (a sombra entra na conta) e publica em
 * `renderStats.js`. `useFrame` só lê o renderer — ferramenta de debug.
 */
export function RenderStatsProbe() {
  const gl = useThree((state) => state.gl)
  const elapsed = useRef(0)
  useFrame((_, delta) => {
    elapsed.current += delta
    if (elapsed.current < INTERVAL) return
    elapsed.current = 0
    const { calls, triangles } = gl.info.render
    setRenderStats({ calls, triangles, dpr: gl.getPixelRatio() })
  })
  return null
}
