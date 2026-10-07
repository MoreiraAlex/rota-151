'use client'

/**
 * Ícone padrão de item sem sprite (ou cuja imagem não carregou) — um desenho
 * simples por categoria sobre a cor dela (`ITEM_COLORS`), pra dar pra
 * distinguir os grupos antes dos sprites de verdade
 * (docs/features/042-itens-da-beta.md). Categoria sem desenho próprio usa o
 * genérico (uma caixa).
 */
export function ItemFallbackIcon({ category, color }) {
  const Glyph = GLYPHS[category] ?? GenericGlyph
  return (
    <span
      className="inline-flex h-5 w-5 items-center justify-center rounded"
      style={{ backgroundColor: color }}
    >
      <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden="true">
        <Glyph />
      </svg>
    </span>
  )
}

function PokeballGlyph() {
  return (
    <>
      <path d="M3 10a7 7 0 0 1 14 0z" fill="#ef4444" />
      <path d="M3 10a7 7 0 0 0 14 0z" fill="#f5f5f5" />
      <circle
        cx="10"
        cy="10"
        r="7"
        fill="none"
        stroke="#111"
        strokeWidth="1.2"
      />
      <path d="M3 10h14" stroke="#111" strokeWidth="1.2" />
      <circle
        cx="10"
        cy="10"
        r="2"
        fill="#f5f5f5"
        stroke="#111"
        strokeWidth="1.2"
      />
    </>
  )
}

function PotionGlyph() {
  return (
    <>
      <rect x="8" y="2.5" width="4" height="3" rx="0.6" fill="#f5f5f5" />
      <path
        d="M7.5 5.5h5v2.2l2.3 3.3a4.2 4.2 0 0 1-3.5 6.5H8.7a4.2 4.2 0 0 1-3.5-6.5l2.3-3.3z"
        fill="#f5f5f5"
      />
      <path
        d="M5.4 12h9.2a4.2 4.2 0 0 1-3.3 5.5H8.7A4.2 4.2 0 0 1 5.4 12z"
        fill="#c084fc"
      />
    </>
  )
}

function BerryGlyph() {
  return (
    <>
      <circle cx="10" cy="11.5" r="5.5" fill="#f5f5f5" />
      <path
        d="M10 6c0-2 1.5-3.3 3.5-3.5-.2 2-1.5 3.3-3.5 3.5z"
        fill="#bbf7d0"
      />
      <path d="M10 6V4.5" stroke="#bbf7d0" strokeWidth="1" />
    </>
  )
}

function ScannerGlyph() {
  return (
    <>
      <rect x="4.5" y="3" width="11" height="14" rx="1.5" fill="#f5f5f5" />
      <rect x="6.5" y="5.5" width="7" height="5" rx="0.5" fill="#60a5fa" />
      <circle cx="10" cy="13.8" r="1.4" fill="#111" />
    </>
  )
}

function GenericGlyph() {
  return (
    <>
      <rect x="4" y="6" width="12" height="10" rx="1.2" fill="#f5f5f5" />
      <path d="M7.5 6V4.5h5V6" fill="none" stroke="#f5f5f5" strokeWidth="1.2" />
    </>
  )
}

const GLYPHS = {
  pokeball: PokeballGlyph,
  consumable: PotionGlyph,
  berry: BerryGlyph,
  scanner: ScannerGlyph,
}
