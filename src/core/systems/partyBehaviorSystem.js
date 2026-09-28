import { entrarEmCombate } from '../actions/combat'
import { defenderGrupo, voltarASeguir } from '../actions/partyBehavior'
import { tentarCorrer } from '../actions/stamina'
import {
  findNearest,
  isActiveCombatant,
  listWildsFightingParty,
  resolveAttackReach,
} from '../battle/combatTargets'
import { getSpecies } from '../data/species'
import { GAME_CONFIG } from '../gameConfig'
import { lerpAngle } from '../math'
import { steerTowards } from '../steering'
import {
  ActionState,
  CharacterController,
  Fainted,
  InputControlled,
  MovementStats,
  PartyBehavior,
  Position,
  Rotation,
  SummonedCreature,
  Velocity,
  Vitals,
  WantsToAttack,
} from '../traits'

function horizontalDistance(a, b) {
  return Math.hypot(b.x - a.x, b.z - a.z)
}

/**
 * Pra uma criatura lutando: o alvo que vale neste tick, ou `null` pra
 * largar a luta. Se afastou demais de quem segue (`LEASH_RADIUS`) → larga.
 * O alvo atual saiu da luta (desmaiou, sumiu) → a selvagem mais perto que
 * ainda está lutando com o grupo (`listWildsFightingParty`), dentro do
 * mesmo limite; nenhuma → larga.
 */
function resolveFightTarget(behavior, pos, leader, fightingWilds) {
  const { LEASH_RADIUS } = GAME_CONFIG.PARTY_BEHAVIOR
  const leaderPos = leader?.get(Position)
  if (leaderPos && horizontalDistance(pos, leaderPos) > LEASH_RADIUS) {
    return null
  }
  if (isActiveCombatant(behavior.target)) return behavior.target

  const inRange = leaderPos
    ? fightingWilds.filter(
        (wild) => horizontalDistance(leaderPos, wild.pos) <= LEASH_RADIUS,
      )
    : fightingWilds
  return findNearest(pos, inRange)?.entity ?? null
}

/**
 * IA de combate das criaturas do time FORA do controle do jogador — sempre
 * defensiva (`PartyBehavior`; quem as põe na luta é o
 * `partyReactionSystem.js`, quando uma selvagem acerta alguém do grupo).
 * Lutando: corre até uma fração do alcance do próprio ataque básico
 * (`PARTY_BEHAVIOR.ATTACK_REACH_FRACTION`), para virada pro alvo e pede
 * golpes nele (`WantsToAttack`, a cada `PARTY_BEHAVIOR.ATTACK_INTERVAL` —
 * mais lento que o jogador —, só o ataque básico, lançados pelo
 * `creatureAttackSystem.js` pelo mesmo caminho do golpe do jogador).
 * Troca pra outra selvagem que está lutando com o grupo quando o alvo sai
 * da luta, e volta a seguir (`voltarASeguir`) quando não sobra nenhuma ou
 * quando se afasta demais de quem segue. Correr gasta stamina
 * (`tentarCorrer`). Lutando fica em modo combate (`entrarEmCombate`).
 *
 * Virar a controlada, ou desmaiar, tira da luta: a controlada é o jogador
 * quem move; a desmaiada fica no chão. Seguir é do
 * `creatureFollowSystem.js`, que pula quem está lutando.
 *
 * Duas passadas, mesmo motivo do `wildBehaviorSystem.js`: decide trocas de
 * estado lendo e aplica depois; depois move quem está lutando.
 *
 * Headless. Fase: simulation, antes do `creatureFollowSystem` e do
 * `characterPhysicsSystem`.
 */
export function partyBehaviorSystem(context) {
  const { world, delta } = context
  const { ATTACK_INTERVAL, ATTACK_REACH_FRACTION } = GAME_CONFIG.PARTY_BEHAVIOR

  const leader = world.queryFirst(InputControlled, Position)
  const fightingWilds = listWildsFightingParty(world)

  const changes = []
  world
    .query(SummonedCreature, PartyBehavior, Position)
    .readEach(([, behavior, pos], entity) => {
      if (behavior.state !== 'fight') return
      if (entity.has(InputControlled) || entity.has(Fainted)) {
        changes.push({ entity, target: null })
        return
      }
      const target = resolveFightTarget(behavior, pos, leader, fightingWilds)
      if (target !== behavior.target) changes.push({ entity, target })
    })

  for (const { entity, target } of changes) {
    if (target) defenderGrupo(entity, target)
    else voltarASeguir(entity)
  }

  world
    .query(
      SummonedCreature,
      PartyBehavior,
      Position,
      Rotation,
      Velocity,
      MovementStats,
      Vitals,
    )
    .updateEach(
      ([creature, behavior, pos, rot, vel, stats, vitals], entity) => {
        if (behavior.state !== 'fight' || !behavior.target) return

        const target = behavior.target
        const targetPos = target.get(Position)
        const toTarget = { x: targetPos.x - pos.x, z: targetPos.z - pos.z }
        const distance = Math.hypot(toTarget.x, toTarget.z)

        entrarEmCombate(entity)
        behavior.attackTimer = Math.max(0, behavior.attackTimer - delta)

        // Golpe em andamento: fica parada (o golpe já virou o corpo).
        if (entity.get(ActionState).current !== null) {
          vel.x = 0
          vel.z = 0
          return
        }

        const reach = resolveAttackReach(
          getSpecies(creature.speciesId),
          target.get(CharacterController),
        )
        // Sem ataque básico na espécie: só acompanha o alvo de perto.
        const stopDistance = (reach ?? 1) * ATTACK_REACH_FRACTION

        if (distance > stopDistance) {
          const speed = tentarCorrer(vitals, delta)
            ? stats.runSpeed
            : stats.walkSpeed
          steerTowards(
            entity,
            { pos, rot, vel, stats },
            targetPos,
            speed,
            delta,
          )
        } else {
          vel.x = 0
          vel.z = 0
          rot.y = lerpAngle(
            rot.y,
            Math.atan2(toTarget.x, toTarget.z),
            stats.turnSpeed * delta,
          )
        }

        if (reach !== null && distance <= reach && behavior.attackTimer <= 0) {
          entity.add(WantsToAttack({ target }))
          behavior.attackTimer = ATTACK_INTERVAL
        }
      },
    )
}
