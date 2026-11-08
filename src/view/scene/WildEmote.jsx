'use client'

import { useEffect, useRef, useState } from 'react'
import { GAME_CONFIG } from '@/core/gameConfig'

const STYLE_ID = 'wild-emote-styles'

// Animações dos emotes (os A/A/A do preview da 063). As variáveis vêm de
// `FEEDBACK.WILD_EMOTE`, postas no elemento de cada emote.
const STYLES = `
.wild-emote { overflow: visible; transform-origin: 50% 100%;
  animation: wild-emote-pop var(--we-pop) cubic-bezier(.34, 1.56, .64, 1) both; }
.wild-emote .we-o { stroke: #1d2230; stroke-width: calc(var(--we-outline) * 2);
  paint-order: stroke; stroke-linejoin: round; stroke-linecap: round; }
.wild-emote .we-i { transform-box: fill-box; transform-origin: center;
  animation-duration: var(--we-loop); animation-delay: var(--we-pop);
  animation-iteration-count: infinite; animation-timing-function: ease-in-out; }
.wild-emote-alert .we-i { animation-name: wild-emote-bob; }
.wild-emote-angry .we-i { animation-name: wild-emote-pulse; }
.wild-emote-fear .we-i { animation-name: wild-emote-drip; animation-timing-function: ease-in; }
.wild-emote-leaving { animation: wild-emote-fade var(--we-fade) ease-in forwards; }
@keyframes wild-emote-pop {
  0% { transform: translateY(8px) scale(0); opacity: 0; }
  60% { transform: translateY(-2px) scale(calc(1 + var(--we-overshoot))); opacity: 1; }
  100% { transform: translateY(0) scale(1); opacity: 1; }
}
@keyframes wild-emote-bob { 50% { transform: translateY(calc(var(--we-amp) * -3px)); } }
@keyframes wild-emote-pulse { 50% { transform: scale(calc(1 + var(--we-amp) * .14)); } }
@keyframes wild-emote-drip {
  0% { transform: translateY(0); opacity: 1; } 80% { opacity: 1; }
  100% { transform: translateY(calc(var(--we-amp) * 8px)); opacity: 0; }
}
@keyframes wild-emote-fade { to { opacity: 0; transform: scale(.6); } }
@media (prefers-reduced-motion: reduce) { .wild-emote .we-i { animation: none; } }
`

const VEIN_ARC = 'M10 27 Q25 25 27 10'

/** O desenho de cada emote (caixa de 64 × 64). */
function EmoteShape({ kind }) {
  if (kind === 'alert') {
    return (
      <g className="we-i">
        <rect
          className="we-o"
          x="26"
          y="6"
          width="12"
          height="36"
          rx="6"
          fill="#ffffff"
        />
        <circle className="we-o" cx="32" cy="53" r="6.5" fill="#ffffff" />
      </g>
    )
  }
  if (kind === 'angry') {
    return (
      <g className="we-i">
        {[0, 90, 180, 270].map((angle) => (
          <g key={angle} transform={`rotate(${angle} 32 32)`}>
            <path
              d={VEIN_ARC}
              fill="none"
              stroke="#1d2230"
              strokeLinecap="round"
              style={{ strokeWidth: 'calc(7px + var(--we-outline) * 2px)' }}
            />
            <path
              d={VEIN_ARC}
              fill="none"
              stroke="#e8352b"
              strokeWidth="7"
              strokeLinecap="round"
            />
          </g>
        ))}
      </g>
    )
  }
  return (
    <g className="we-i">
      <g transform="translate(32 34) scale(1.5)">
        <path
          className="we-o"
          d="M0 -16 C0 -16 -11 -2 -11 5 a11 11 0 0 0 22 0 C11 -2 0 -16 0 -16Z"
          fill="#4aa8ff"
        />
        <ellipse cx="-4" cy="4" rx="2.4" ry="4" fill="rgba(255,255,255,.75)" />
      </g>
    </g>
  )
}

function ensureStyles() {
  if (typeof document === 'undefined') return
  if (document.getElementById(STYLE_ID)) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = STYLES
  document.head.appendChild(style)
}

/**
 * O emote acima da cabeça de uma selvagem (`WildAwareness.emote`,
 * docs/features/063-revisao-da-ia-selvagem.md): a exclamação branca ao te
 * perceber, a veia de raiva ao partir para cima e a gota de suor ao fugir.
 * Entra com um pop, fica no loop próprio de cada um e, quando o emote acaba
 * (ou troca), o anterior some rápido. SVG + CSS, sem textura; os números
 * são do `FEEDBACK.WILD_EMOTE`. Quem posiciona e esconde pela névoa é a
 * `NameplateView.jsx`.
 *
 * Recebe o `emote` pronto (lido pela `NameplateView` com `useTrait`): este
 * componente vive dentro do `<Html>` do drei, que renderiza numa raiz React
 * separada, sem o `WorldProvider` do koota — hook do koota aqui quebra.
 */
export function WildEmote({ emote = null }) {
  // O que está na tela: o emote atual, ou o anterior saindo.
  const [shown, setShown] = useState(null)
  const counter = useRef(0)

  useEffect(ensureStyles, [])

  useEffect(() => {
    if (emote) {
      counter.current += 1
      setShown({ kind: emote, key: counter.current, leaving: false })
      return undefined
    }
    setShown((current) => (current ? { ...current, leaving: true } : null))
    const timer = setTimeout(
      () => setShown((current) => (current?.leaving ? null : current)),
      GAME_CONFIG.FEEDBACK.WILD_EMOTE.FADE_DURATION,
    )
    return () => clearTimeout(timer)
  }, [emote])

  if (!shown) return null
  const config = GAME_CONFIG.FEEDBACK.WILD_EMOTE
  return (
    <svg
      key={shown.key}
      viewBox="0 0 64 64"
      width={config.SIZE}
      height={config.SIZE}
      aria-hidden="true"
      className={`wild-emote wild-emote-${shown.kind}${shown.leaving ? ' wild-emote-leaving' : ''}`}
      style={{
        '--we-pop': `${config.POP_DURATION}ms`,
        '--we-overshoot': config.POP_OVERSHOOT,
        '--we-amp': config.LOOP_AMPLITUDE,
        '--we-loop': `${config.LOOP_DURATION}ms`,
        '--we-outline': config.OUTLINE,
        '--we-fade': `${config.FADE_DURATION}ms`,
      }}
    >
      <EmoteShape kind={shown.kind} />
    </svg>
  )
}
