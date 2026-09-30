import { getSpecies } from '../data/species'
import { ActionState, SummonedCreature, Velocity } from '../traits'

/**
 * Estado inicial de `ActionState` pra uma criatura recém-invocada: a ação
 * `'appeal'` (apresentação), se a espécie declarar
 * `actions.appeal.duration`. Sem isso, nasce livre (`{}` = defaults do
 * trait). `animationSpeed` segue a regra de toda ação (`1 / duration`, ver
 * `ActionState`) — com `duration` igual ao clipe, toca na velocidade
 * original.
 */
export function resolveAppealActionState(species) {
  const duration = species?.actions?.appeal?.duration
  if (!duration) return {}
  return { current: 'appeal', elapsed: 0, animationSpeed: 1 / duration }
}

/**
 * Avança a ação `'appeal'` das criaturas do time (iniciada no spawn, ver
 * `summonBallSystem.js`) e a encerra ao fim de `actions.appeal.duration`.
 * Enquanto dura, a criatura fica parada — quem a moveria (follow, IA de
 * luta, controle direto) já respeita `ActionState.current !== null`.
 *
 * Dono de escrita: `ActionState` enquanto `current === 'appeal'`.
 * Fase: simulation, depois de `summonBallSystem`.
 */
export function creatureAppealSystem(context) {
  const { world, delta } = context

  world
    .query(SummonedCreature, ActionState, Velocity)
    .updateEach(([creature, action, vel]) => {
      if (action.current !== 'appeal') return

      vel.x = 0
      vel.z = 0
      action.elapsed += delta

      const duration =
        getSpecies(creature.speciesId)?.actions?.appeal?.duration ?? 0
      if (action.elapsed >= duration) action.current = null
    })
}
