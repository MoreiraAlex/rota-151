import { getSpecies } from '../data/species'
import {
  iniciarAtordoamentoPorCondicao,
  resolveHitStunDuration,
} from '../actions/hitStun'
import { isConditionStunned } from '../actions/conditions'
import { ActionState, Velocity, resolveCreatureSpeciesId } from '../traits'

/**
 * Avança a ação `'hit'` (atordoada — iniciada por `iniciarAtordoamento`,
 * `core/actions/hitStun.js`, quando um golpe de status é interrompido) e a
 * encerra ao fim da duração da espécie (`resolveHitStunDuration`). Enquanto
 * dura, a criatura fica parada.
 *
 * Atordoada por CONDIÇÃO (`stun` da condição, ex.: a paralisia —
 * `isConditionStunned`): entra na ação `'stunned'`, interrompendo o que
 * estiver fazendo (o golpe em andamento é perdido, sem recarga), fica
 * parada enquanto a condição dura e sai quando ela acaba.
 *
 * Dono de escrita: `ActionState` enquanto `current === 'hit'` ou
 * `'stunned'`.
 * Fase: simulation, depois de `creatureAttackSystem` (quem inicia a ação).
 */
export function creatureHitStunSystem(context) {
  const { world, delta } = context

  world.query(ActionState, Velocity).updateEach(([action, vel], entity) => {
    const stunned = isConditionStunned(entity)
    if (stunned && action.current !== 'stunned') {
      iniciarAtordoamentoPorCondicao(action)
    }
    if (action.current === 'stunned') {
      vel.x = 0
      vel.z = 0
      action.elapsed += delta
      if (!stunned) action.current = null
      return
    }
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
