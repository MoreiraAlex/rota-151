import { entrarEmCombate } from '../actions/combat'
import { defenderGrupo, voltarASeguir } from '../actions/partyBehavior'
import { planAiAttack } from '../battle/aiAttackChoice'
import { resolveEntityHitTrigger } from '../battle/attackTargets'
import { resolveResting } from '../battle/aiEnergy'
import { resolveAiTuning } from '../battle/aiTuning'
import { advanceAiDash, moveInFight } from '../battle/aiMovement'
import {
  findNearest,
  findWeakest,
  isActiveCombatant,
  listWildsFightingParty,
  resolveAttackReach,
} from '../battle/combatTargets'
import { isPerceived } from '../battle/perception'
import { resolveGroupLeader, resolveOwner } from '../actions/owner'
import { getSpecies } from '../data/species'
import { GAME_CONFIG } from '../gameConfig'
import {
  defendsGroup,
  resolveCreaturePosture,
  seeksWilds,
} from '../party/posture'
import {
  ActionState,
  Fainted,
  InputControlled,
  MovementStats,
  PartyAttackers,
  PartyBehavior,
  Position,
  Rotation,
  SummonedCreature,
  Training,
  Velocity,
  Vitals,
  WantsToAttack,
  WildBehavior,
  WildCreature,
  ChunkFrozen,
} from '../traits'

function horizontalDistance(a, b) {
  return Math.hypot(b.x - a.x, b.z - a.z)
}

/**
 * Pra uma criatura do time: o alvo que vale neste tick, ou `null` (seguindo:
 * não entra; lutando: larga a luta) — pela postura dela (`core/party/
 * posture.js`, docs/features/064-revisao-da-ia-do-parceiro.md, Parte 2).
 *
 * Se afastou demais de quem segue (`LEASH_RADIUS`) → `null`. Senão:
 * - **neutra**: só as selvagens que a acertaram (`PartyAttackers`) e ainda
 *   lutam com o grupo, no limite — mantém o alvo enquanto ele for uma
 *   delas, senão a de menos vida; não protege o treinador;
 * - **defensiva**: uma selvagem mirando o TREINADOR → ela (proteger quem
 *   não luta, `findTrainerHunter`); o alvo atual ainda na luta → ele; senão
 *   a selvagem com MENOS vida (empate: a mais perto) que está lutando com o
 *   grupo (`listWildsFightingParty`, `findWeakest`), dentro do mesmo limite;
 * - **agressiva**: a defensiva, contando também as selvagens que ela vê
 *   (`PARTY_BEHAVIOR.PERCEPTION`, a mesma regra das selvagens — `isPerceived`)
 *   dentro do limite.
 *
 * Seguindo (`target` `null`), isso é o gatilho de entrar: a defensiva entra
 * quando uma selvagem parte para cima de alguém do grupo (`'chase'` — a
 * veia de raiva, não o "!"), a agressiva também ao ver uma. Quem não está
 * mais na luta (`isActiveCombatant`: sendo capturada, fugindo, desmaiada)
 * nunca é alvo.
 */
function resolvePostureTarget(entity, posture, behavior, pos, rot, group) {
  const { trainer, leader, fightingWilds } = group
  const { LEASH_RADIUS, PERCEPTION } = GAME_CONFIG.PARTY_BEHAVIOR
  const leaderPos = leader?.get(Position)
  if (leaderPos && horizontalDistance(pos, leaderPos) > LEASH_RADIUS) {
    return null
  }
  const inLeash = (wild) =>
    !leaderPos || horizontalDistance(leaderPos, wild.pos) <= LEASH_RADIUS

  if (!defendsGroup(posture)) {
    const attackers = entity.get(PartyAttackers)?.entries ?? []
    const candidates = fightingWilds.filter(
      (wild) => attackers.includes(wild.entity) && inLeash(wild),
    )
    if (candidates.some((wild) => wild.entity === behavior.target)) {
      return behavior.target
    }
    return findWeakest(pos, candidates)?.entity ?? null
  }

  // Proteger o treinador: selvagem mirando nele (no limite) vira o alvo,
  // mesmo no meio de outra luta.
  const hunter = findTrainerHunter(pos, leaderPos, fightingWilds, trainer)
  if (hunter) return hunter
  if (isActiveCombatant(behavior.target)) return behavior.target

  const candidates = fightingWilds.filter(inLeash)
  if (seeksWilds(posture)) {
    for (const wild of group.activeWilds()) {
      if (candidates.some((other) => other.entity === wild.entity)) continue
      if (!inLeash(wild)) continue
      if (!isPerceived(pos, rot.y, wild.pos, PERCEPTION)) continue
      candidates.push(wild)
    }
  }
  return findWeakest(pos, candidates)?.entity ?? null
}

/** Toda selvagem ainda na luta (`isActiveCombatant`), com posição. */
function listActiveWilds(world) {
  const list = []
  world.query(WildCreature, Position).forEach((entity) => {
    if (isActiveCombatant(entity)) {
      list.push({ entity, pos: entity.get(Position) })
    }
  })
  return list
}

/**
 * A selvagem (mais perto) que está mirando o TREINADOR dono agora, entre as
 * que lutam com o grupo e dentro do limite de quem segue — ou `null`. A
 * criatura do time protege quem não luta (Parte 4).
 */
function findTrainerHunter(pos, leaderPos, fightingWilds, trainer) {
  const { LEASH_RADIUS } = GAME_CONFIG.PARTY_BEHAVIOR
  const hunters = fightingWilds.filter((wild) => {
    if (wild.entity.get(WildBehavior).target !== trainer) return false
    return !leaderPos || horizontalDistance(leaderPos, wild.pos) <= LEASH_RADIUS
  })
  return findNearest(pos, hunters)?.entity ?? null
}

/** Se a criatura pode entrar numa luta agora (seguindo, fora do controle). */
function canJoinFight(entity) {
  return (
    !entity.has(InputControlled) &&
    !entity.has(Fainted) &&
    !entity.has(Training) &&
    !entity.has(ChunkFrozen)
  )
}

/**
 * IA de combate das criaturas do time FORA do controle do jogador, pela
 * postura de cada uma (`resolvePostureTarget`; o golpe que acerta alguém do
 * grupo também põe na luta — `partyReactionSystem.js`).
 * Lutando: escolhe o golpe (um dos dela,
 * `planAiAttack` — `core/battle/aiAttackChoice.js`), corre até uma fração
 * do alcance DELE (`PARTY_BEHAVIOR.ATTACK_REACH_FRACTION`), para virada pro
 * alvo e pede o golpe (`WantsToAttack`, no ritmo da dificuldade do time —
 * `PARTY_DIFFICULTY`, `resolveAiTuning`; na ponta difícil o
 * `PARTY_BEHAVIOR.ATTACK_INTERVAL`, mais lento que o jogador —, lançados
 * pelo `creatureAttackSystem.js` pelo mesmo caminho do golpe do jogador).
 * Troca de alvo quando o dela sai da luta, e volta a seguir (`voltarASeguir`)
 * quando não sobra nenhum ou quando se afasta demais de quem segue. Correr
 * gasta stamina (`tentarCorrer`); com a energia baixa, descansa
 * (`resolveResting`, `core/battle/aiEnergy.js`): sem golpe e sem correr até
 * recuperar. Lutando fica em modo combate (`entrarEmCombate`).
 *
 * Virar a controlada, ou desmaiar, tira da luta: a controlada é o jogador
 * quem move; a desmaiada fica no chão. A que treina ou está num chunk
 * descarregado não entra. Seguir é do `creatureFollowSystem.js`, que pula
 * quem está lutando.
 *
 * Duas passadas, mesmo motivo do `wildBehaviorSystem.js`: decide trocas de
 * estado lendo e aplica depois; depois move quem está lutando.
 *
 * Headless. Fase: simulation, antes do `creatureFollowSystem` e do
 * `characterPhysicsSystem`.
 */
export function partyBehaviorSystem(context) {
  const { world, delta } = context
  const { ATTACK_REACH_FRACTION } = GAME_CONFIG.PARTY_BEHAVIOR

  // Cada criatura luta pelo grupo do PRÓPRIO dono (`OwnedBy`): o líder que
  // ela segue e as selvagens brigando com aquele time. Montado uma vez por
  // treinador por tick.
  // As selvagens à vista (só a agressiva usa): lidas uma vez por tick, na
  // primeira vez que alguém pede.
  let activeWilds = null
  const listActive = () => (activeWilds ??= listActiveWilds(world))
  const groups = new Map()
  const groupOf = (entity) => {
    const trainer = resolveOwner(entity)
    if (!groups.has(trainer)) {
      groups.set(trainer, {
        trainer,
        leader: resolveGroupLeader(world, trainer),
        fightingWilds: listWildsFightingParty(world, trainer),
        activeWilds: listActive,
      })
    }
    return groups.get(trainer)
  }

  const changes = []
  world
    .query(SummonedCreature, PartyBehavior, Position, Rotation)
    .readEach(([, behavior, pos, rot], entity) => {
      if (behavior.state === 'fight') {
        if (entity.has(InputControlled) || entity.has(Fainted)) {
          changes.push({ entity, target: null })
          return
        }
      } else if (!canJoinFight(entity)) {
        return
      }
      const target = resolvePostureTarget(
        entity,
        resolveCreaturePosture(entity),
        behavior,
        pos,
        rot,
        groupOf(entity),
      )
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
        // Num chunk descarregado: parada até ele voltar (046).
        if (entity.has(ChunkFrozen)) return

        const target = behavior.target
        const { fightingWilds } = groupOf(entity)
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
        // Ritmo dos golpes e descanso pela dificuldade do time (064).
        const tuning = resolveAiTuning(entity)
        behavior.resting = resolveResting(
          behavior.resting,
          vitals,
          tuning.REST_ENTER_FRACTION,
        )
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
          resolveAttackReach(entity, species, resolveEntityHitTrigger(target))
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
          behavior.attackTimer = tuning.ATTACK_INTERVAL
          behavior.lastAttackSlot = plan.slot
          behavior.attackSlot = null
        }
      },
    )
}
