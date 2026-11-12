import { INTERIOR_SOUNDS } from '@/core/data/audio/interiorSounds'
import { InteriorTransition } from '@/core/traits'
import { playUiSound, preloadUiSounds } from '../audio/uiSounds'

// A fase da passagem pela porta no quadro anterior (estado de tela).
let previousPhase = null
let preloaded = false

/**
 * O som da porta automática (docs/features/068-interior-dos-predios.md):
 * toca quando a passagem começa (a tela começa a escurecer), entrando ou
 * saindo. Carrega o som antes da primeira porta.
 *
 * Fase: presentation.
 */
export function interiorAudioSystem({ world }) {
  if (!preloaded) {
    preloadUiSounds({ door: INTERIOR_SOUNDS.door })
    preloaded = true
  }
  const phase = world.get(InteriorTransition)?.phase ?? null
  if (phase === 'out' && previousPhase !== 'out') {
    playUiSound(INTERIOR_SOUNDS.door)
  }
  previousPhase = phase
}
