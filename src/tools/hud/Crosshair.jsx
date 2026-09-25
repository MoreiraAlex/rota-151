'use client'

/**
 * Retículo, fixo no centro da tela — representa a direção que
 * `computeAimRay` (core/camera/orbitCamera.js) usa pra calcular pra onde o
 * arremesso vai. Só decorativo (não lê nenhum trait) — a direção real é
 * sempre a mesma câmera que já está olhando pro centro da tela, então não
 * precisa recalcular nada aqui.
 *
 * Sempre visível agora — antes só aparecia com o botão direito do mouse
 * segurado (mira/`AimAnchor`, removida, ver docs/features/029-*.md); sem
 * mais um "modo mira" separado, o arremesso (clique esquerdo) está sempre
 * pronto, então o retículo também fica sempre em tela.
 */
export function Crosshair() {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <div className="h-1.5 w-1.5 rounded-full border border-red-500/80 bg-red-500/40" />
    </div>
  )
}
