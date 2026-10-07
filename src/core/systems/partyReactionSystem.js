import { defenderGrupo } from '../actions/partyBehavior'
import { pararTreino } from '../actions/training'
import { resolveOwner } from '../actions/owner'
import { isActiveCombatant, isPlayerSide } from '../battle/combatTargets'
import { EVENT_TYPES } from '../events'
import {
  Fainted,
  InputControlled,
  OwnedBy,
  PartyBehavior,
  SummonedCreature,
  Training,
  WildCreature,
} from '../traits'

/**
 * A criatura do time fora do controle é sempre DEFENSIVA (`PartyBehavior`):
 * quando uma selvagem ACERTA alguém do grupo (treinador ou criatura do
 * time — `attackResolved` com `hit`, lido de `context.events.stepEvents()`),
 * toda criatura do time que está só seguindo entra na luta contra ela
 * (`defenderGrupo`). Quem já está lutando mantém o alvo; a controlada, a
 * desmaiada e a que está treinando não entram. Uma criatura que treina e é
 * ATACADA (golpe, mesmo errando, ou drenagem) sai do treino — e, se foi
 * acertada, entra na luta com as outras.
 *
 * Headless. Fase: events (depois do golpe resolvido); o movimento começa
 * no próximo passo (`partyBehaviorSystem.js`).
 */
export function partyReactionSystem(context) {
  const { world, events } = context

  for (const event of events.stepEvents()) {
    // Atacada (errando ou não, ou drenada) no meio do treino: sai dele
    // (docs/features/038-*) — e, se o golpe acertou, defende como as outras.
    stopTrainingIfAttacked(event)

    if (event.type !== EVENT_TYPES.ATTACK_RESOLVED) continue
    if (event.result !== 'hit') continue
    const { attacker, target } = event
    if (!attacker?.has?.(WildCreature) || !isActiveCombatant(attacker)) continue
    if (!isPlayerSide(target)) continue
    // Só o time de quem apanhou defende (outro treinador é neutro).
    const owner = resolveOwner(target)
    if (!owner) continue

    world
      .query(SummonedCreature, PartyBehavior, OwnedBy(owner))
      .forEach((creature) => {
        if (creature.has(InputControlled) || creature.has(Fainted)) return
        // Treinando: só sai do treino se ELA for atacada (acima).
        if (creature.has(Training)) return
        if (creature.get(PartyBehavior).state !== 'follow') return
        defenderGrupo(creature, attacker)
      })
  }
}

/**
 * Golpe (mesmo errando) ou drenagem do Leech Seed numa criatura que está
 * treinando: o treino acaba (`pararTreino`).
 */
function stopTrainingIfAttacked(event) {
  const target =
    event.type === EVENT_TYPES.ATTACK_RESOLVED ||
    event.type === EVENT_TYPES.LEECH_SEED_DRAINED
      ? event.target
      : null
  if (!target?.isAlive?.() || !target.has(Training)) return
  pararTreino(target)
}
