'use client'

import { useFrame } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import { runFixedPipeline, runRenderPipeline } from '../systems/pipeline'
import { registerGameSystems } from '../systems'

const FIXED_TIMESTEP = 1 / 60

export function GameLoop() {
  const accumulator = useRef(0)

  useEffect(() => {
    registerGameSystems()
  }, [])

  useFrame((_, delta) => {
    // Acumula o tempo desde o último frame
    accumulator.current += delta

    // Executa a simulação em passos fixos
    while (accumulator.current >= FIXED_TIMESTEP) {
      runFixedTick(FIXED_TIMESTEP)
      accumulator.current -= FIXED_TIMESTEP
    }

    // Atualizações de renderização (por frame)
    runRenderTick(delta)
  })

  return null
}

function runFixedTick(delta) {
  runFixedPipeline({ delta })
}

function runRenderTick(delta) {
  runRenderPipeline({ delta })
}
