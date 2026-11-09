'use client'

import { useEffect } from 'react'
import { disposeMusic } from './musicPlayer'
import { resetMusicSystem } from '@/view/systems/musicSystem'

/**
 * Dono do ciclo de vida da música de fundo (docs/features/065-sons-do-
 * mundo.md, Parte 2): o tocador nasce no primeiro frame do `musicSystem`;
 * ao sair da cena, este componente para tudo e larga os áudios. Sem visual;
 * monta uma vez em `GameScene.jsx`.
 */
export function MusicAudio() {
  useEffect(
    () => () => {
      disposeMusic()
      resetMusicSystem()
    },
    [],
  )
  return null
}
