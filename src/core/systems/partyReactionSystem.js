import { defenderGrupo } from '../actions/partyBehavior'
import { isActiveCombatant, isPlayerSide } from '../battle/combatTargets'
import { EVENT_TYPES } from '../events'
import {
  Fainted,
  InputControlled,
  PartyBehavior,
  SummonedCreature,
  WildCreature,
} from '../traits'

/**
 * A criatura do time fora do controle é sempre DEFENSIVA (`PartyBehavior`):
 * quando uma selvagem ACERTA alguém do grupo (treinador ou criatura do
 * time — `attackResolved` com `hit`, lido de `context.events.stepEvents()`),
 * toda criatura do time que está só seguindo entra na luta contra ela
 * (`defenderGrupo`). Quem já está lutando mantém o alvo; a controlada e a
 * desmaiada não entram.
 *
 * Headless. Fase: events (depois do golpe resolvido); o movimento começa
 * no próximo passo (`partyBehaviorSystem.js`).
 */
export function partyReactionSystem(context) {
  const { world, events } = context

  for (const event of events.stepEvents()) {
    if (event.type !== EVENT_TYPES.ATTACK_RESOLVED) continue
    if (event.result !== 'hit') continue
    const { attacker, target } = event
    if (!attacker?.has?.(WildCreature) || !isActiveCombatant(attacker)) continue
    if (!isPlayerSide(target)) continue

    world.query(SummonedCreature, PartyBehavior).forEach((creature) => {
      if (creature.has(InputControlled) || creature.has(Fainted)) return
      if (creature.get(PartyBehavior).state !== 'follow') return
      defenderGrupo(creature, attacker)
    })
  }
}
