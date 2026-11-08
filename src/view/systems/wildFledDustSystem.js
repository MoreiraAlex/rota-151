import { EVENT_TYPES } from '@/core/events'
import { getSpecies } from '@/core/data/species'
import { verticalClearance } from '@/core/physics/colliders'
import { requestDustPuff } from '@/view/vfx/dustPuffQueue'

/**
 * A selvagem que fugiu some numa nuvem de poeira (a fuga clássica,
 * docs/features/063-revisao-da-ia-selvagem.md): cada `WILD_DESPAWNED` com
 * motivo `'fled'` em `context.frameEvents` pede uma nuvem nos pés de onde
 * ela estava (a posição do evento é o centro da cápsula; desce o corpo da
 * espécie) — a `JumpDustView.jsx` solta no próximo quadro.
 *
 * Fase: presentation.
 */
export function wildFledDustSystem(context) {
  for (const event of context.frameEvents) {
    if (event.type !== EVENT_TYPES.WILD_DESPAWNED) continue
    if (event.reason !== 'fled' || !event.position) continue
    const body = getSpecies(event.speciesId)?.body
    const { x, y, z } = event.position
    requestDustPuff({ x, y: body ? y - verticalClearance(body) : y, z })
  }
}
