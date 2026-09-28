import { PartyBehavior, PathState } from '../traits'

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
  entity.set(PartyBehavior, { state: 'fight', target })
  resetPath(entity)
}

/** Criatura do time larga a luta e volta a seguir quem está no controle. */
export function voltarASeguir(entity) {
  entity.set(PartyBehavior, { state: 'follow', target: null })
  resetPath(entity)
}
