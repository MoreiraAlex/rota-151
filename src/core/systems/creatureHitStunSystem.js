import { getSpecies } from '../data/species'
import { resolveHitStunDuration } from '../actions/hitStun'
import { ActionState, Velocity, resolveCreatureSpeciesId } from '../traits'

/**
 * Avança a ação `'hit'` (atordoada — iniciada por `iniciarAtordoamento`,
 * `core/actions/hitStun.js`, quando um golpe de status é interrompido) e a
 * encerra ao fim da duração da espécie (`resolveHitStunDuration`). Enquanto
 * dura, a criatura fica parada.
 *
 * Dono de escrita: `ActionState` enquanto `current === 'hit'`.
 * Fase: simulation, depois de `creatureAttackSystem` (quem inicia a ação).
 */
export function creatureHitStunSystem(context) {
  const { world, delta } = context

  world.query(ActionState, Velocity).updateEach(([action, vel], entity) => {
    if (action.current !== 'hit') return

    vel.x = 0
    vel.z = 0
    action.elapsed += delta

    const species = getSpecies(resolveCreatureSpeciesId(entity))
    if (action.elapsed >= resolveHitStunDuration(species)) {
      action.current = null
    }
  })
}
