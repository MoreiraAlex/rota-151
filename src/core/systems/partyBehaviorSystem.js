import { entrarEmCombate } from '../actions/combat'
import { defenderGrupo, voltarASeguir } from '../actions/partyBehavior'
import { planAiAttack } from '../battle/aiAttackChoice'
import { resolveResting } from '../battle/aiEnergy'
import { advanceAiDash, moveInFight } from '../battle/aiMovement'
import {
  findNearest,
  findWeakest,
  isActiveCombatant,
  listWildsFightingParty,
  resolveAttackReach,
} from '../battle/combatTargets'
import { getSpecies } from '../data/species'
import { GAME_CONFIG } from '../gameConfig'
import {
  ActionState,
  CharacterController,
  Fainted,
  InputControlled,
  MovementStats,
  Party,
  PartyBehavior,
  Position,
  Rotation,
  SummonedCreature,
  Velocity,
  Vitals,
  WantsToAttack,
  WildBehavior,
} from '../traits'

function horizontalDistance(a, b) {
  return Math.hypot(b.x - a.x, b.z - a.z)
}

/**
 * Pra uma criatura lutando: o alvo que vale neste tick, ou `null` pra
 * largar a luta. Se afastou demais de quem segue (`LEASH_RADIUS`) → larga.
 * Uma selvagem mirando o TREINADOR → ela (proteger quem não luta,
 * `findTrainerHunter`). O alvo atual saiu da luta (desmaiou, sumiu) → a selvagem com MENOS vida
 * (empate: a mais perto) que ainda está lutando com o grupo
 * (`listWildsFightingParty`, `findWeakest`), dentro do mesmo limite —
 * terminar a luta; nenhuma → larga.
 */
function resolveFightTarget(behavior, pos, leader, fightingWilds) {
  const { LEASH_RADIUS } = GAME_CONFIG.PARTY_BEHAVIOR
  const leaderPos = leader?.get(Position)
  if (leaderPos && horizontalDistance(pos, leaderPos) > LEASH_RADIUS) {
    return null
  }
  // Proteger o treinador: selvagem mirando nele (no limite) vira o alvo,
  // mesmo no meio de outra luta.
  const hunter = findTrainerHunter(pos, leaderPos, fightingWilds)
  if (hunter) return hunter
  if (isActiveCombatant(behavior.target)) return behavior.target

  const inRange = leaderPos
    ? fightingWilds.filter(
        (wild) => horizontalDistance(leaderPos, wild.pos) <= LEASH_RADIUS,
      )
    : fightingWilds
  return findWeakest(pos, inRange)?.entity ?? null
}

/**
 * A selvagem (mais perto) que está mirando o TREINADOR agora, entre as que
 * lutam com o grupo e dentro do limite de quem segue — ou `null`. A criatura
 * do time protege quem não luta (Parte 4).
 */
function findTrainerHunter(pos, leaderPos, fightingWilds) {
  const { LEASH_RADIUS } = GAME_CONFIG.PARTY_BEHAVIOR
  const hunters = fightingWilds.filter((wild) => {
    const target = wild.entity.get(WildBehavior).target
    if (!target?.has(Party)) return false
    return !leaderPos || horizontalDistance(leaderPos, wild.pos) <= LEASH_RADIUS
  })
  return findNearest(pos, hunters)?.entity ?? null
}

/**
 * IA de combate das criaturas do time FORA do controle do jogador — sempre
 * defensiva (`PartyBehavior`; quem as põe na luta é o
 * `partyReactionSystem.js`, quando uma selvagem acerta alguém do grupo).
 * Lutando: escolhe o golpe (um dos dela,
 * `planAiAttack` — `core/battle/aiAttackChoice.js`), corre até uma fração
 * do alcance DELE (`PARTY_BEHAVIOR.ATTACK_REACH_FRACTION`), para virada pro
 * alvo e pede o golpe (`WantsToAttack`, a cada
 * `PARTY_BEHAVIOR.ATTACK_INTERVAL` — mais lento que o jogador —, lançados
 * pelo `creatureAttackSystem.js` pelo mesmo caminho do golpe do jogador).
 * Troca pra outra selvagem que está lutando com o grupo quando o alvo sai
 * da luta, e volta a seguir (`voltarASeguir`) quando não sobra nenhuma ou
 * quando se afasta demais de quem segue. Correr gasta stamina
 * (`tentarCorrer`); com a energia baixa, descansa (`resolveResting`,
 * `core/battle/aiEnergy.js`): sem golpe e sem correr até recuperar. Lutando
 * fica em modo combate (`entrarEmCombate`).
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

        // Dash em andamento (desvio/aproximação): segue nele.
        const current = entity.get(ActionState).current
        if (current === 'dash') {
          advanceAiDash(entity, { rot, vel, stats }, delta)
          return
        }
        // Golpe em andamento: fica parada (o golpe já virou o corpo).
        if (current !== null) {
          vel.x = 0
          vel.z = 0
          return
        }

        // Energia baixa: descansa (sem golpe, sem correr) até recuperar.
        behavior.resting = resolveResting(behavior.resting, vitals)
        // Escolhe o golpe e corre até o alcance DELE —
        // sem nada pronto, até o menor alcance entre os golpes dela.
        const species = getSpecies(creature.speciesId)
        const plan = behavior.resting
          ? null
          : planAiAttack(
              entity,
              species,
              target,
              fightingWilds,
              behavior.attackSlot,
            )
        behavior.attackSlot = plan?.slot ?? null
        const reach =
          plan?.reach ??
          resolveAttackReach(entity, species, target.get(CharacterController))
        // Sem golpe nenhum na espécie: só acompanha o alvo de perto.
        const stopDistance = (reach ?? 1) * ATTACK_REACH_FRACTION

        // Desvia, recua, corre até o alcance, rodeia ou para (`aiMovement.js`).
        const mode = moveInFight(entity, {
          pos,
          rot,
          vel,
          stats,
          vitals,
          target,
          plan,
          stopDistance,
          enemies: fightingWilds,
          resting: behavior.resting,
          waiting: !plan || behavior.attackTimer > 0,
          delta,
        })

        // Menos desviando, de dash ou ainda virando pro alvo (`'aim'`).
        if (
          plan &&
          mode !== 'dodge' &&
          mode !== 'dash' &&
          mode !== 'aim' &&
          distance <= plan.reach &&
          behavior.attackTimer <= 0
        ) {
          entity.add(WantsToAttack({ target, slot: plan.slot }))
          behavior.attackTimer = ATTACK_INTERVAL
          behavior.lastAttackSlot = plan.slot
          behavior.attackSlot = null
        }
      },
    )
}
