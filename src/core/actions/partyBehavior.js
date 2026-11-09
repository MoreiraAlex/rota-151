import { isActiveCombatant } from '../battle/combatTargets'
import { PartyAttackers, PartyBehavior, PathState } from '../traits'

// Troca de estado recalcula o caminho já no próximo tick (o alvo mudou).
function resetPath(entity) {
  entity.set(PathState, {
    waypoints: [],
    waypointIndex: 0,
    repathTimer: 0,
    wasBlocked: false,
    target: null,
  })
}

/**
 * Criatura do time (fora do controle) entra na luta pra defender o grupo,
 * contra a selvagem `target`. Troca de alvo no meio da luta também passa
 * por aqui.
 */
export function defenderGrupo(entity, target) {
  entity.set(PartyBehavior, { state: 'fight', target, attackSlot: null })
  resetPath(entity)
}

/** Criatura do time larga a luta e volta a seguir quem está no controle. */
export function voltarASeguir(entity) {
  entity.set(PartyBehavior, {
    state: 'follow',
    target: null,
    attackSlot: null,
  })
  if (entity.has(PartyAttackers)) entity.set(PartyAttackers, { entries: [] })
  resetPath(entity)
}

/**
 * Guarda que a selvagem `attacker` acertou a criatura do time `entity`
 * (`PartyAttackers`) — quem já saiu da luta sai da lista.
 */
export function registrarAgressor(entity, attacker) {
  const current = entity.get(PartyAttackers)?.entries ?? []
  const entries = current.filter(
    (other) => other !== attacker && isActiveCombatant(other),
  )
  entries.push(attacker)
  if (entity.has(PartyAttackers)) entity.set(PartyAttackers, { entries })
  else entity.add(PartyAttackers({ entries }))
}
