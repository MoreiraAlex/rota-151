'use client'

import { useQueryFirst, useTrait } from 'koota/react'
import { GAME_CONFIG } from '@/core/gameConfig'
import { CaptureAimStatus, Party } from '@/core/traits'

const SIZE = 38

/**
 * Retículo da mira da Pokébola (docs/features/043-captura.md), no centro da
 * tela, só enquanto o treinador mira (`CaptureAimStatus`, escrito só quando
 * muda). Duas variantes, por `GAME_CONFIG.CAPTURE.AIM.MODE`:
 *
 * - `'arc'`: um ponto pequeno — quem mostra onde a bola vai é o arco na cena
 *   (`CaptureAimView.jsx`);
 * - `'reticle'` (Legends Arceus): um círculo que fica vermelho e "trava"
 *   (cantos e ponto no meio) quando a bola pegaria um selvagem, e apagado
 *   quando ela não chega a bater em nada.
 */
export function CaptureAimHud() {
  const trainer = useQueryFirst(Party, CaptureAimStatus)
  const status = useTrait(trainer, CaptureAimStatus)
  if (!status?.active) return null

  const { FEEDBACK } = GAME_CONFIG
  const color = status.onWild
    ? FEEDBACK.AIM_TARGET_COLOR
    : status.inRange
      ? FEEDBACK.AIM_COLOR
      : FEEDBACK.AIM_OUT_OF_RANGE_COLOR

  if (GAME_CONFIG.CAPTURE.AIM.MODE !== 'reticle') {
    return (
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div
          className="h-1.5 w-1.5 rounded-full"
          style={{ background: color, boxShadow: '0 0 3px rgba(0,0,0,0.8)' }}
        />
      </div>
    )
  }

  const locked = status.onWild
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <svg
        width={SIZE}
        height={SIZE}
        viewBox="0 0 38 38"
        style={{
          opacity: status.inRange ? 1 : 0.45,
          transform: `scale(${locked ? 0.85 : 1})`,
          transition: 'transform 120ms ease-out, opacity 120ms',
          filter: 'drop-shadow(0 0 2px rgba(0,0,0,0.8))',
        }}
      >
        <circle
          cx="19"
          cy="19"
          r="14"
          fill="none"
          stroke={color}
          strokeWidth="2"
        />
        {locked && (
          <>
            <circle cx="19" cy="19" r="2.5" fill={color} />
            {[0, 90, 180, 270].map((angle) => (
              <line
                key={angle}
                x1="19"
                y1="1"
                x2="19"
                y2="6"
                stroke={color}
                strokeWidth="2.5"
                transform={`rotate(${angle} 19 19)`}
              />
            ))}
          </>
        )}
      </svg>
    </div>
  )
}
