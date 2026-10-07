import { derrubarComida } from '../actions/eating'
import { EVENT_TYPES } from '../events'
import { Eating } from '../traits'

// Eventos de dano (o alvo perdeu HP neste passo).
const DAMAGE_EVENTS = new Set([
  EVENT_TYPES.ATTACK_RESOLVED,
  EVENT_TYPES.BURN_DAMAGED,
  EVENT_TYPES.LEECH_SEED_DRAINED,
])

/**
 * Tomar dano comendo derruba a comida (docs/features/042-itens-da-beta.md):
 * lê os eventos de dano do passo (`context.events.stepEvents()`) — golpe que
 * acertou com dano, queimadura e Leech Seed — e chama `derrubarComida` no
 * alvo que estava comendo. Golpe de status (sem dano) não interrompe.
 *
 * Headless. Fase: events (depois de todo o `simulation` do passo).
 */
export function eatingInterruptSystem(context) {
  const { world, events } = context

  for (const event of events.stepEvents()) {
    if (!DAMAGE_EVENTS.has(event.type)) continue
    if (!(event.damage > 0)) continue
    const target = event.target
    if (!target?.isAlive?.() || !target.has(Eating)) continue
    derrubarComida(world, target)
  }
}
