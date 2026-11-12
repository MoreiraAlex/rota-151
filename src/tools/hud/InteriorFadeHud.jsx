'use client'

import { useTrait, useWorld } from 'koota/react'
import { GAME_CONFIG } from '@/core/gameConfig'
import { InteriorTransition } from '@/core/traits'

/**
 * A tela escurecendo e clareando ao passar pela porta de um prédio
 * (docs/features/068-interior-dos-predios.md): preta na fase `'out'` (vai
 * escurecendo em `INTERIOR.FADE_OUT` s); fora dela, transparente (clareia
 * em `INTERIOR.FADE_IN` s). Por cima de tudo, sem pegar o mouse.
 */
export function InteriorFadeHud() {
  const world = useWorld()
  const transition = useTrait(world, InteriorTransition)
  const isDark = transition?.phase === 'out'
  const { FADE_OUT, FADE_IN } = GAME_CONFIG.INTERIOR
  return (
    <div
      className="pointer-events-none absolute inset-0 z-50 bg-black"
      style={{
        opacity: isDark ? 1 : 0,
        transition: `opacity ${isDark ? FADE_OUT : FADE_IN}s ease-in-out`,
      }}
    />
  )
}
