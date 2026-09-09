'use client'

import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { runFixedPipeline, runRenderPipeline } from '@/core/systems'
import { GAME_CONFIG } from '@/core/gameConfig'
import { world } from '@/core/world/world'
import { createKeyboardInput } from '@/platform/input/keyboardInput'
import { registerGameSystems } from './registerSystems'

const { FIXED_TIMESTEP, MAX_FRAME_TIME, MAX_STEPS_PER_FRAME } = GAME_CONFIG.LOOP

/**
 * Orquestrador do loop. É o ÚNICO lugar do projeto com useFrame.
 *
 * Passo fixo: input → simulation → events, com clamp contra "spiral of death".
 * Passo variável: presentation (sincronização visual e câmera).
 */
export function GameLoop() {
  const accumulator = useRef(0)
  const keyboard = useMemo(() => createKeyboardInput(), [])
  const { camera } = useThree()

  useEffect(() => {
    registerGameSystems()
    keyboard.start()
    return () => keyboard.stop()
  }, [keyboard])

  useFrame((_, delta) => {
    accumulator.current += Math.min(delta, MAX_FRAME_TIME)

    let steps = 0
    while (
      accumulator.current >= FIXED_TIMESTEP &&
      steps < MAX_STEPS_PER_FRAME
    ) {
      runFixedPipeline({
        world,
        delta: FIXED_TIMESTEP,
        input: keyboard.snapshot(),
      })
      accumulator.current -= FIXED_TIMESTEP
      steps += 1
    }

    // Estourou o teto de passos: descarta o backlog em vez de tentar recuperar.
    if (steps === MAX_STEPS_PER_FRAME) {
      accumulator.current = 0
    }

    runRenderPipeline({ world, delta, camera })
  })

  return null
}
