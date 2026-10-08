import { GAME_CONFIG } from '@/core/gameConfig'
import { getItem } from '@/core/data/items'

/**
 * Regras do feixe de luz da Pokébola (`RecallBeamView.jsx`,
 * docs/features/043-captura.md) — puras.
 */

/** A cor do feixe: a da bola (`pokeball.beamColor`) ou a padrão. */
export function resolveBeamColor(itemId) {
  return (
    getItem(itemId)?.pokeball?.beamColor ??
    GAME_CONFIG.FEEDBACK.PHASE_BEAM.DEFAULT_COLOR
  )
}

/**
 * Quanto do feixe/envelope aparece em `t` (0–1 da vida dele), pelo modo:
 * - entrando (`'recall'`, `'capture'`): o envelope encolhe e vai até a bola
 *   (`envelopeTravel`, fração do caminho criatura → bola);
 * - saindo (`'sendOut'`): o envelope cresce no lugar da criatura.
 * Os dois somem no fim (`fade`). `{ envelopeScale, envelopeTravel, fade }`.
 */
export function resolveBeamPhase(mode, t) {
  const fade = 1 - t * t
  if (mode === 'sendOut') {
    return { envelopeScale: Math.min(1, t * 2), envelopeTravel: 0, fade }
  }
  return { envelopeScale: 1 - t, envelopeTravel: t, fade }
}
