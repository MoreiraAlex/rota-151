import { WORLD_ITEM_SOUNDS } from '@/core/data/audio/worldItemSounds'
import { EVENT_TYPES } from '@/core/events'
import { playWorldSound } from '../audio/worldSounds'

/**
 * Sons dos itens no mundo (docs/features/055-itens-no-mundo.md), no ponto
 * em que acontecem: pegar um item do chão; vasculhar um arbusto ou uma
 * árvore (o farfalhar sempre; achando fruta, a colheita e o de pegar
 * junto).
 *
 * Fase: presentation (lê `context.frameEvents`).
 */
export function worldItemFeedbackSystem(context) {
  for (const event of context.frameEvents ?? []) {
    if (event.type === EVENT_TYPES.WORLD_ITEM_PICKED) {
      playWorldSound(WORLD_ITEM_SOUNDS.pickup, event.position)
    } else if (event.type === EVENT_TYPES.BERRIES_HARVESTED) {
      playWorldSound(WORLD_ITEM_SOUNDS.rustle, event.position)
      playWorldSound(WORLD_ITEM_SOUNDS.harvest, event.position)
      playWorldSound(WORLD_ITEM_SOUNDS.pickup, event.position)
    } else if (event.type === EVENT_TYPES.FORAGED_NOTHING) {
      playWorldSound(WORLD_ITEM_SOUNDS.rustle, event.position)
    }
  }
}
