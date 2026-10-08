'use client'

import { useEffect } from 'react'

/**
 * Avisa quando a cena 3D montou de verdade (docs/features/044-salvar-o-
 * jogo.md). Fica dentro do `<Canvas>`: o R3F só monta a árvore depois que
 * tudo que suspende (modelos do `useGLTF`, texturas) terminou — então o
 * efeito daqui só roda com a cena pronta. A página tira o "Carregando…".
 */
export function SceneReady({ onReady }) {
  useEffect(() => {
    onReady()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return null
}
