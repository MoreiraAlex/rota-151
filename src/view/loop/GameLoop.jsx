'use client'

import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { runFixedPipeline, runRenderPipeline } from '@/core/systems'
import { GAME_CONFIG } from '@/core/gameConfig'
import { world } from '@/core/world/world'
import { initPhysics, disposePhysics } from '@/core/physics/physicsWorld'
import { createKeyboardInput } from '@/platform/input/keyboardInput'
import { createPointerInput } from '@/platform/input/pointerInput'
import { createEventQueue } from '@/core/events'
import { registerGameSystems } from './registerSystems'

const { FIXED_TIMESTEP, MAX_FRAME_TIME, MAX_STEPS_PER_FRAME } = GAME_CONFIG.LOOP

/**
 * Orquestrador do loop. É o ÚNICO lugar do projeto com useFrame.
 *
 * Passo fixo: input → simulation → events, com clamp contra "spiral of death".
 * Passo variável: presentation (sincronização visual e câmera).
 *
 * Eventos (`core/events/`): systems do passo fixo emitem em
 * `context.events`; a fila é drenada UMA vez por frame, logo antes da
 * apresentação, e a lista vai pra ela como `context.frameEvents` — assim
 * um evento emitido em qualquer um dos passos fixos do frame é visto
 * exatamente uma vez pelos efeitos visuais/sonoros. A fase `events` do
 * passo fixo continua sem system (fica pra consumidor de GAMEPLAY).
 *
 * `castModeOverride` (prop, vira `context.settings.castModeOverride`):
 * força o modo de lançamento de todo ataque (`creatureAttackSystem.js`) —
 * a página passa `'confirm'` no modo debug (F2), `null` fora dele.
 */
export function GameLoop({ castModeOverride = null }) {
  const accumulator = useRef(0)
  const keyboard = useMemo(() => createKeyboardInput(), [])
  const pointer = useMemo(() => createPointerInput(), [])
  const events = useMemo(() => createEventQueue(), [])
  const { camera, gl } = useThree()

  useEffect(() => {
    registerGameSystems()
    keyboard.start()
    pointer.start(gl.domElement)
    // Carrega o WASM do Rapier em background; os systems de física fazem
    // early-return até estar pronto.
    initPhysics()
    return () => {
      keyboard.stop()
      pointer.stop()
      disposePhysics()
    }
  }, [keyboard, pointer, gl])

  useFrame((_, delta) => {
    accumulator.current += Math.min(delta, MAX_FRAME_TIME)

    let steps = 0
    while (
      accumulator.current >= FIXED_TIMESTEP &&
      steps < MAX_STEPS_PER_FRAME
    ) {
      // pointer.snapshot() drena os deltas acumulados — chamado a cada passo
      // fixo, o primeiro consome o movimento e os seguintes recebem zero.
      runFixedPipeline({
        world,
        delta: FIXED_TIMESTEP,
        input: { ...keyboard.snapshot(), ...pointer.snapshot() },
        events,
        settings: { castModeOverride },
      })
      accumulator.current -= FIXED_TIMESTEP
      steps += 1
    }

    // Estourou o teto de passos: descarta o backlog em vez de tentar recuperar.
    if (steps === MAX_STEPS_PER_FRAME) {
      accumulator.current = 0
    }

    runRenderPipeline({ world, delta, camera, frameEvents: events.drain() })
  })

  return null
}
