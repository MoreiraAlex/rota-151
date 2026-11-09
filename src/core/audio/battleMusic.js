import { resolveOwner } from '../actions/owner'
import { isActiveCombatant } from '../battle/combatTargets'
import {
  OwnedBy,
  PartyBehavior,
  SummonedCreature,
  WildBehavior,
  WildCreature,
} from '../traits'

/**
 * Regras da música de batalha (docs/features/065-sons-do-mundo.md, Parte
 * 3), sem áudio nenhum. Quem toca é `view/systems/musicSystem.js`.
 */

/**
 * Se o grupo do `trainer` está numa luta com uma selvagem: uma selvagem está
 * perseguindo alguém do grupo (`WildBehavior.state` `'chase'` — partiu pra
 * cima ou revidou um golpe), ou uma criatura dele está lutando com uma
 * (`PartyBehavior.state` `'fight'`). A selvagem tem que estar ainda na luta
 * (`isActiveCombatant`): desmaiada ou dentro da Pokébola, ela para de
 * decidir e o `'chase'` dela fica parado, mas a luta acabou. Golpe no vazio
 * não conta (só põe quem atacou em modo combate); luta só entre selvagens,
 * ou de outro treinador, também não.
 */
export function isGroupInBattle(world, trainer) {
  if (!trainer?.isAlive?.()) return false
  const fighting = world
    .query(SummonedCreature, PartyBehavior, OwnedBy(trainer))
    .some((creature) => {
      const { state, target } = creature.get(PartyBehavior)
      return state === 'fight' && isActiveCombatant(target)
    })
  if (fighting) return true
  return world.query(WildCreature, WildBehavior).some((wild) => {
    const { state, target } = wild.get(WildBehavior)
    return (
      state === 'chase' &&
      resolveOwner(target) === trainer &&
      isActiveCombatant(wild)
    )
  })
}

/**
 * Espera pra sair da batalha: entra na hora em que há luta e só sai depois
 * de `holdTime` s seguidos sem luta. Devolve o estado novo
 * (`{ active, quietTime }`), sem mexer no antigo.
 */
export function advanceBattleHold(hold, inBattle, delta, holdTime) {
  if (inBattle) return { active: true, quietTime: 0 }
  if (!hold?.active) return { active: false, quietTime: 0 }
  const quietTime = hold.quietTime + delta
  if (quietTime >= holdTime) return { active: false, quietTime: 0 }
  return { active: true, quietTime }
}
