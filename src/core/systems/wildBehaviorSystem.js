import { entrarEmCombate } from '../actions/combat'
import { resolveMoveSpeed } from '../actions/movementSpeed'
import { tentarCorrer } from '../actions/stamina'
import {
  decairAmeaca,
  fugirDoJogador,
  perseguirJogador,
  voltarAVagar,
} from '../actions/wildBehavior'
import { planAiAttack } from '../battle/aiAttackChoice'
import { resolveFleeDestination } from '../battle/flee'
import { resolveResting } from '../battle/aiEnergy'
import { advanceAiDash, moveInFight } from '../battle/aiMovement'
import {
  isLowHp,
  isRecoveredFromLowHp,
  resolveBehaviorRadius,
  rollLowHpFlee,
} from '../battle/wildBehavior'
import {
  excludeCoveredTrainer,
  findNearest,
  listPlayerSide,
  resolveAttackReach,
  resolveWildTarget,
} from '../battle/combatTargets'
import { getSpecies } from '../data/species'
import { GAME_CONFIG } from '../gameConfig'
import { gameplayRng } from '../rng'
import { steerTowards } from '../steering'
import {
  ActionState,
  CharacterController,
  BeingCaptured,
  Fainted,
  MovementBlocked,
  MovementStats,
  Position,
  Rotation,
  Velocity,
  Vitals,
  WantsToAttack,
  WildBehavior,
  WildCreature,
  ChunkFrozen,
} from '../traits'

/**
 * Alvo desta selvagem neste tick (entre `candidates`, o lado do jogador
 * ativo) e a troca de estado que ela faz (ou `null`), comparando a
 * distância até o alvo com o limite do estado atual
 * (`resolveBehaviorRadius`):
 * - vagando (hostil): o mais perto; dentro do raio de aggro → persegue;
 * - perseguindo: quem mais causou dano nela (`Threat`) ou, sem ameaça, o
 *   mais perto (`resolveWildTarget`); além do limite → volta a vagar;
 * - fugindo: foge do mais perto; além da distância segura → volta a vagar.
 * Pacífica vagando não tem limite — só muda apanhando
 * (`wildReactionSystem.js`). Sem ninguém do lado do jogador na luta, quem
 * perseguia/fugia volta a vagar.
 */
function resolveDecision(entity, behavior, pos, allCandidates) {
  // Fugindo, foge de qualquer um; senão o treinador só conta se for o único
  // do lado do jogador no raio dela (`excludeCoveredTrainer`).
  const candidates =
    behavior.state === 'flee'
      ? allCandidates
      : excludeCoveredTrainer(
          allCandidates,
          pos,
          resolveBehaviorRadius(behavior),
        )
  const target =
    behavior.state === 'chase'
      ? resolveWildTarget(entity, pos, candidates)
      : findNearest(pos, candidates)

  if (!target) {
    return {
      target: null,
      next: behavior.state === 'wander' ? null : 'wander',
    }
  }

  const radius = resolveBehaviorRadius(behavior)
  if (radius === null) return { target: null, next: null }

  if (behavior.state === 'wander') {
    return target.distance <= radius
      ? { target, next: 'chase' }
      : { target: null, next: null }
  }
  return target.distance > radius
    ? { target: null, next: 'wander' }
    : { target, next: null }
}

/**
 * Comportamento das selvagens em relação ao lado do jogador — treinador e
 * criaturas do time, controladas ou não (`listPlayerSide`), não só quem
 * está no controle: hostil persegue quem chegar no raio de aggro e desiste
 * fora do limite; perseguindo, mira quem mais causou dano nela (`Threat`,
 * somado pelo `wildReactionSystem.js`) ou, sem ameaça, o mais perto
 * (`resolveWildTarget`) — lutar em grupo custa: as criaturas do time
 * também apanham. Escolhe o golpe (um dos dela,
 * `planAiAttack` — `core/battle/aiAttackChoice.js`), chega até uma fração
 * do alcance DELE (`ATTACK_REACH_FRACTION`), para virada pro alvo e pede o
 * golpe (`WantsToAttack`, a cada `ATTACK_INTERVAL`, lançados pelo
 * `creatureAttackSystem.js`), parada enquanto o golpe acontece; fugindo,
 * corre pra longe do mais perto até uma distância segura. Correr gasta
 * stamina (`tentarCorrer`); sem fôlego, anda. Com a energia baixa,
 * descansa perseguindo (`resolveResting`, `core/battle/aiEnergy.js`): sem
 * golpe e sem correr até recuperar. Vagar é do
 * `wildWanderSystem.js`. O alvo do tick fica em `WildBehavior.target`.
 *
 * Perseguir põe (e mantém) a selvagem em modo combate
 * (`entrarEmCombate` — olho bravo), igual a quem ataca.
 *
 * Duas passadas: decide alvo e trocas de estado lendo (`readEach`) e
 * aplica DEPOIS (as actions escrevem em `WildBehavior`, que não pode
 * mudar no meio de um `updateEach` que o percorre); depois move quem está
 * perseguindo/fugindo.
 *
 * Headless. Fase: simulation, antes do `wildWanderSystem` (quem voltou a
 * vagar neste tick já vaga no mesmo tick) e do `characterPhysicsSystem`.
 */
/**
 * Fuga com HP baixo (docs/features/034-ia-de-batalha.md, Parte 3): perseguindo
 * com a vida em `LOW_HP_FLEE_FRACTION` ou menos, sorteia UMA vez nessa queda
 * se foge (`rollLowHpFlee`); fugindo assim fica `shaken` — não persegue
 * ninguém até a vida voltar a `LOW_HP_RECOVER_FRACTION`, quando o sorteio
 * também volta a valer. Devolve `{ shaken, lowHpRolled, fleeNow }`.
 */
function resolveMorale(behavior, vitals) {
  let { shaken, lowHpRolled } = behavior
  if (!vitals) return { shaken, lowHpRolled, fleeNow: false }
  if (isRecoveredFromLowHp(vitals)) {
    shaken = false
    lowHpRolled = false
  }
  let fleeNow = false
  if (behavior.state === 'chase' && isLowHp(vitals) && !lowHpRolled) {
    lowHpRolled = true
    if (rollLowHpFlee(gameplayRng)) {
      fleeNow = true
      shaken = true
    }
  }
  return { shaken, lowHpRolled, fleeNow }
}

export function wildBehaviorSystem(context) {
  const { world, delta } = context
  const {
    ATTACK_INTERVAL,
    ATTACK_REACH_FRACTION,
    CHASE_STOP_GAP,
    FLEE_REPICK_INTERVAL,
    FLEE_ARRIVE_DISTANCE,
  } = GAME_CONFIG.WILD_BEHAVIOR

  const candidates = listPlayerSide(world)

  const decisions = []
  world
    .query(WildCreature, WildBehavior, Position)
    .readEach(([, behavior, pos], entity) => {
      // Desmaiada ou dentro de uma Pokébola (docs/features/043-captura.md):
      // não decide nada.
      if (entity.has(Fainted) || entity.has(BeingCaptured)) return
      const morale = resolveMorale(behavior, entity.get(Vitals))
      let decision = morale.fleeNow
        ? { target: findNearest(pos, candidates), next: 'flee' }
        : resolveDecision(entity, behavior, pos, candidates)
      // Abalada (fugiu com a vida baixa): não volta a perseguir ainda.
      if (morale.shaken && decision.next === 'chase') {
        decision = { target: null, next: null }
      }
      decisions.push({ entity, ...decision, morale, pos: { ...pos } })
    })

  for (const { entity, next, target, morale, pos } of decisions) {
    if (next === 'chase') perseguirJogador(entity, { provoked: false })
    else if (next === 'flee') fugirDoJogador(entity)
    else if (next === 'wander') voltarAVagar(entity, pos)
    entity.set(WildBehavior, {
      shaken: morale.shaken,
      lowHpRolled: morale.lowHpRolled,
    })
    decairAmeaca(entity, delta)
    const nextTarget = target?.entity ?? null
    // Alvo novo: o golpe planejado pro anterior não vale mais.
    if (nextTarget !== entity.get(WildBehavior).target) {
      entity.set(WildBehavior, { target: nextTarget, attackSlot: null })
    } else {
      entity.set(WildBehavior, { target: nextTarget })
    }
  }

  world
    .query(
      WildCreature,
      WildBehavior,
      Position,
      Rotation,
      Velocity,
      MovementStats,
      CharacterController,
      Vitals,
    )
    .updateEach(
      ([creature, behavior, pos, rot, vel, stats, body, vitals], entity) => {
        if (behavior.state === 'wander') return
        if (entity.has(Fainted) || entity.has(BeingCaptured)) return
        // Num chunk descarregado: parada até ele voltar (046).
        if (entity.has(ChunkFrozen)) return
        const target = behavior.target
        if (!target) return

        const targetPos = target.get(Position)
        const targetBody = target.get(CharacterController)
        const toTarget = { x: targetPos.x - pos.x, z: targetPos.z - pos.z }
        const distance = Math.hypot(toTarget.x, toTarget.z)
        const moving = { pos, rot, vel, stats }
        // Correr (perseguir/fugir) gasta stamina; sem fôlego, anda.
        const runOrWalk = () =>
          resolveMoveSpeed(stats, vitals, tentarCorrer(vitals, delta))

        if (behavior.state === 'flee') {
          // Destino guardado, refeito no intervalo, ao chegar ou travando —
          // escolhido entre várias direções, só ponto andável
          // (`resolveFleeDestination`): sem isso, com obstáculo ou a borda do
          // mapa no caminho, ela corria contra a parede.
          behavior.fleeTimer -= delta
          const arrived =
            behavior.hasFleePoint &&
            Math.hypot(behavior.fleeX - pos.x, behavior.fleeZ - pos.z) <=
              FLEE_ARRIVE_DISTANCE
          if (
            !behavior.hasFleePoint ||
            behavior.fleeTimer <= 0 ||
            arrived ||
            entity.has(MovementBlocked)
          ) {
            const point = resolveFleeDestination(pos, targetPos)
            if (point) {
              behavior.hasFleePoint = true
              behavior.fleeX = point.x
              behavior.fleeZ = point.z
            }
            behavior.fleeTimer = FLEE_REPICK_INTERVAL
          }
          if (behavior.hasFleePoint) {
            steerTowards(
              entity,
              moving,
              { x: behavior.fleeX, z: behavior.fleeZ },
              runOrWalk(),
              delta,
            )
          } else {
            vel.x = 0
            vel.z = 0
          }
          return
        }

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
              candidates,
              behavior.attackSlot,
            )
        behavior.attackSlot = plan?.slot ?? null
        const reach =
          plan?.reach ?? resolveAttackReach(entity, species, targetBody)
        const stopDistance =
          reach !== null
            ? reach * ATTACK_REACH_FRACTION
            : body.capsuleRadius + targetBody.capsuleRadius + CHASE_STOP_GAP

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
          enemies: candidates,
          resting: behavior.resting,
          waiting: !plan || behavior.attackTimer > 0,
          delta,
        })

        // Ao alcance e com o intervalo vencido: pede o golpe nele
        // (`creatureAttackSystem.js` lança no próximo tick) — menos
        // desviando, de dash ou ainda virando pro alvo (`'aim'`).
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
