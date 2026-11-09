'use client'

import { useEffect } from 'react'
import { GAME_CONFIG } from '@/core/gameConfig'

const STYLE_ID = 'recall-warning-styles'

// A Pokébola balança e pisca em vermelho; o ritmo vem do `--rw-blink`,
// que acelera na reta final.
const STYLES = `
.recall-warning { overflow: visible; transform-origin: 50% 100%;
  animation: recall-warning-pop var(--rw-pop) cubic-bezier(.34, 1.56, .64, 1) both; }
.recall-warning .rw-ball { transform-box: fill-box; transform-origin: 50% 90%;
  animation: recall-warning-wobble var(--rw-blink) ease-in-out infinite; }
.recall-warning .rw-glow { animation: recall-warning-glow var(--rw-blink) ease-in-out infinite; }
@keyframes recall-warning-pop {
  0% { transform: translateY(6px) scale(0); opacity: 0; }
  100% { transform: translateY(0) scale(1); opacity: 1; }
}
@keyframes recall-warning-wobble {
  0%, 100% { transform: rotate(0deg); }
  25% { transform: rotate(-14deg); }
  75% { transform: rotate(14deg); }
}
@keyframes recall-warning-glow { 0%, 100% { opacity: 0; } 50% { opacity: .85; } }
@media (prefers-reduced-motion: reduce) {
  .recall-warning .rw-ball { animation: none; }
}
`

function ensureStyles() {
  if (typeof document === 'undefined') return
  if (document.getElementById(STYLE_ID)) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = STYLES
  document.head.appendChild(style)
}

/**
 * A Pokébola balançando e piscando acima da plaquinha da criatura que vai
 * ser puxada para a bola (`StrayWarning`, docs/features/064-revisao-da-ia-
 * do-parceiro.md, Parte 1). Na contagem, pisca no ritmo de
 * `FEEDBACK.RECALL_WARNING.BLINK_SLOW` e acelera para `BLINK_FAST` na reta
 * final; no aviso sem contagem (`'warn'`), fica no ritmo lento.
 *
 * Recebe o aviso pronto (lido pela `NameplateView` com `useTrait`): vive
 * dentro do `<Html>` do drei, sem o provider do koota — mesmo motivo do
 * `WildEmote.jsx`.
 */
export function RecallWarningIcon({ warning = null }) {
  useEffect(ensureStyles, [])
  if (!warning) return null

  const config = GAME_CONFIG.FEEDBACK.RECALL_WARNING
  const fast =
    warning.stage === 'recall' && warning.timeLeft <= config.FAST_BELOW
  const blink = fast ? config.BLINK_FAST : config.BLINK_SLOW

  return (
    <svg
      viewBox="0 0 64 64"
      width={config.SIZE}
      height={config.SIZE}
      aria-hidden="true"
      className="recall-warning"
      style={{
        '--rw-blink': `${blink}ms`,
        // Entra com o mesmo pop dos emotes das selvagens (063).
        '--rw-pop': `${GAME_CONFIG.FEEDBACK.WILD_EMOTE.POP_DURATION}ms`,
      }}
    >
      <circle className="rw-glow" cx="32" cy="32" r="30" fill="#ff3b3b" />
      <g className="rw-ball">
        <circle
          cx="32"
          cy="32"
          r="24"
          fill="#f5f5f5"
          stroke="#1d2230"
          strokeWidth="4"
        />
        <path
          d="M8 32 a24 24 0 0 1 48 0 Z"
          fill="#e8352b"
          stroke="#1d2230"
          strokeWidth="4"
        />
        <line x1="8" y1="32" x2="56" y2="32" stroke="#1d2230" strokeWidth="5" />
        <circle
          cx="32"
          cy="32"
          r="7"
          fill="#f5f5f5"
          stroke="#1d2230"
          strokeWidth="4"
        />
      </g>
    </svg>
  )
}
