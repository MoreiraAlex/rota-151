'use client'

import { useEffect, useRef } from 'react'
import { getAudioListener } from './audioListener'
import { registerAmbientRoot, unregisterAmbientRoot } from './ambientBeds'

/**
 * Som ambiente do mundo (docs/features/065-sons-do-mundo.md, Parte 4): monta
 * os fundos e os avulsos (`ambientBeds.js`) — a coruja, que vem de um ponto
 * do mundo, mora no grupo desta cena. Quem toca é `ambientBedSystem.js`.
 * Sem visual; monta uma vez em `GameScene.jsx`. (Substitui o vento avulso
 * do nível da 019.)
 *
 * Autoplay do navegador: o `AudioContext` só toca depois de um gesto real
 * do usuário. O listener (`getAudioListener()`) é o mesmo de todos os sons
 * do jogo, então retomar o contexto aqui no primeiro `pointerdown` libera
 * tudo — passos, vozes, música, ambiente.
 */
export function AmbientAudio() {
  const groupRef = useRef()

  useEffect(() => {
    const group = groupRef.current
    registerAmbientRoot(group)

    const listener = getAudioListener()
    const startOnGesture = () => listener.context.resume()
    window.addEventListener('pointerdown', startOnGesture, { once: true })

    return () => {
      window.removeEventListener('pointerdown', startOnGesture)
      unregisterAmbientRoot(group)
    }
  }, [])

  return <group ref={groupRef} />
}
