'use client'

import { useEffect, useState } from 'react'

/**
 * Retículo de mira, fixo no centro da tela — representa a direção que
 * `computeAimRay` (core/camera/orbitCamera.js) usa pra calcular pra onde o
 * arremesso vai (ver docs/features/016-mira-e-arremesso.md). Só decorativo
 * (não lê nenhum trait) — a direção real é sempre a mesma câmera que já
 * está olhando pro centro da tela, então não precisa recalcular nada aqui.
 *
 * Só aparece enquanto o botão direito do mouse está segurado (mirar virou
 * um estado contínuo, não mais "solta o ponteiro" — ver
 * `platform/input/pointerInput.js`), com o ponteiro travado. Rastreia
 * `mousedown`/`mouseup` do botão direito de forma independente do
 * `pointerInput.js` (mesmo padrão já usado em `app/(auth)/page.js` pra
 * `pointerlockchange` — múltiplos ouvintes no mesmo evento nativo do
 * browser não conflitam, não precisa de um estado compartilhado central).
 */
export function Crosshair() {
  const [aiming, setAiming] = useState(false)

  useEffect(() => {
    const onMouseDown = (event) => {
      if (event.button === 2 && document.pointerLockElement) setAiming(true)
    }
    const onMouseUp = (event) => {
      if (event.button === 2) setAiming(false)
    }
    const onLockChange = () => {
      if (!document.pointerLockElement) setAiming(false)
    }

    window.addEventListener('mousedown', onMouseDown)
    window.addEventListener('mouseup', onMouseUp)
    document.addEventListener('pointerlockchange', onLockChange)
    return () => {
      window.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('mouseup', onMouseUp)
      document.removeEventListener('pointerlockchange', onLockChange)
    }
  }, [])

  if (!aiming) return null

  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <div className="h-1.5 w-1.5 rounded-full border border-red-500/80 bg-red-500/40" />
    </div>
  )
}
