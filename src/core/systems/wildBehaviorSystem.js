import { entrarEmCombate } from '../actions/combat'
import { resolveMoveSpeed } from '../actions/movementSpeed'
import { tentarCorrer } from '../actions/stamina'
import { decairAmeaca, voltarAVagar } from '../actions/wildBehavior'
import { despawnarSelvagem } from '../actions/wildSpawn'
import { planAiAttack } from '../battle/aiAttackChoice'
import { resolveEntityHitTrigger } from '../battle/attackTargets'
import { resolveResting } from '../battle/aiEnergy'
import { resolveAiTuning } from '../battle/aiTuning'
import { advanceAiDash, moveInFight } from '../battle/aiMovement'
import { resolveBehaviorRadius } from '../battle/wildBehavior'
import {
  excludeCoveredTrainer,
  listPlayerSide,
  resolveAttackReach,
  resolveWildTarget,
} from '../battle/combatTargets'
import { getSpecies } from '../data/species'
import { GAME_CONFIG } from '../gameConfig'
import { steerTowards } from '../steering'
import {
  ActionState,
  CharacterController,
  BeingCaptured,
  Fainted,
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
import { readConditionModifier } from '../actions/conditions'

// Quão longe (m) fica o ponto para onde quem está saindo corre — só a
// direção importa; longe o bastante para não chegar antes de sumir.
const LEAVE_STEER_DISTANCE = 20

/**
 * Alvo de uma selvagem PERSEGUINDO neste tick (entre `candidates`, o lado
 * do jogador ativo) e se ela desiste: quem mais causou dano nela (`Threat`)
 * ou, sem ameaça, o mais perto (`resolveWildTarget`); além do limite
 * (`resolveBehaviorRadius`) ou sem ninguém, volta a vagar. Quem começa a
 * perseguir é decidido pela percepção (`wildAwarenessSystem.js`) e pela
 * reação ao apanhar (`wildReactionSystem.js`), não aqui.
 */
function resolveChaseDecision(entity, behavior, pos, allCandidates) {
  const radius = resolveBehaviorRadius(behavior)
  // O treinador só conta se for o único do lado do jogador no raio dela
  // (`excludeCoveredTrainer`).
  const candidates = excludeCoveredTrainer(allCandidates, pos, radius)
  const target = resolveWildTarget(entity, pos, candidates)
  if (!target || target.distance > radius) {
    return { target: null, next: 'wander' }
  }
  return { target, next: null }
}

/**
 * Comportamento das selvagens em relação ao lado do jogador — treinador e
 * criaturas do time, controladas ou não (`listPlayerSide`), não só quem
 * está no controle.
 *
 * - **Perseguindo** (`'chase'`): mira quem mais causou dano nela (`Threat`,
 *   somado pelo `wildReactionSystem.js`) ou, sem ameaça, o mais perto
 *   (`resolveWildTarget`) — lutar em grupo custa: as criaturas do time
 *   também apanham — e desiste fora do limite. Escolhe o golpe (um dos dela,
 *   `planAiAttack` — `core/battle/aiAttackChoice.js`), chega até uma fração
 *   do alcance DELE (`ATTACK_REACH_FRACTION`), para virada pro alvo e pede o
 *   golpe (`WantsToAttack`, a cada `ATTACK_INTERVAL` da dificuldade,
 *   lançados pelo `creatureAttackSystem.js`), parada enquanto o golpe
 *   acontece. Correr gasta stamina (`tentarCorrer`); sem fôlego, anda. Com a
 *   energia baixa, descansa (`resolveResting`, `core/battle/aiEnergy.js`):
 *   sem golpe e sem correr até recuperar. Na luta ninguém foge.
 * - **Saindo** (`'leave'`, a fuga clássica — docs/features/063-revisao-da-ia-
 *   selvagem.md): corre na direção escolhida ao decidir fugir até o
 *   `leaveTimer` acabar e sai do mapa (`despawnarSelvagem`, motivo
 *   `'fled'` — a view solta a poeira e o log mostra que fugiu).
 * - Vagar é do `wildWanderSystem.js`; perceber e decidir, do
 *   `wildAwarenessSystem.js`.
 *
 * Perseguir põe (e mantém) a selvagem em modo combate
 * (`entrarEmCombate` — olho bravo), igual a quem ataca.
 *
 * Duas passadas: decide alvo e trocas de estado lendo (`readEach`) e
 * aplica DEPOIS (as actions escrevem em `WildBehavior`, que não pode
 * mudar no meio de um `updateEach` que o percorre); depois move quem está
 * perseguindo/saindo. Quem terminou de sair some no fim, fora da query.
 *
 * Headless. Fase: simulation, depois do `wildAwarenessSystem` e antes do
 * `wildWanderSystem` (quem voltou a vagar neste tick já vaga no mesmo tick)
 * e do `characterPhysicsSystem`.
 */
export function wildBehaviorSystem(context) {
  const { world, delta, events } = context
  const { ATTACK_REACH_FRACTION, CHASE_STOP_GAP } = GAME_CONFIG.WILD_BEHAVIOR

  const candidates = listPlayerSide(world)

  const decisions = []
  world
    .query(WildCreature, WildBehavior, Position)
    .readEach(([, behavior, pos], entity) => {
      // Desmaiada ou dentro de uma Pokébola (docs/features/043-captura.md):
      // não decide nada.
      if (entity.has(Fainted) || entity.has(BeingCaptured)) return
      if (behavior.state !== 'chase') return
      const decision = resolveChaseDecision(entity, behavior, pos, candidates)
      decisions.push({ entity, ...decision, pos: { ...pos } })
    })

  for (const { entity, next, target, pos } of decisions) {
    if (next === 'wander') voltarAVagar(entity, pos)
    decairAmeaca(entity, delta)
    const nextTarget = target?.entity ?? null
    // Alvo novo: o golpe planejado pro anterior não vale mais.
    if (nextTarget !== entity.get(WildBehavior).target) {
      entity.set(WildBehavior, { target: nextTarget, attackSlot: null })
    } else {
      entity.set(WildBehavior, { target: nextTarget })
    }
  }

  const left = []
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
        const moving = { pos, rot, vel, stats }
        // Correr (perseguir/sair) gasta stamina; sem fôlego, anda.
        const runOrWalk = () =>
          resolveMoveSpeed(
            stats,
            tentarCorrer(vitals, delta),
            readConditionModifier(entity, 'movement'),
          )

        if (behavior.state === 'leave') {
          behavior.leaveTimer -= delta
          if (behavior.leaveTimer <= 0) {
            vel.x = 0
            vel.z = 0
            left.push(entity)
            return
          }
          steerTowards(
            entity,
            moving,
            {
              x: pos.x + behavior.leaveDirX * LEAVE_STEER_DISTANCE,
              z: pos.z + behavior.leaveDirZ * LEAVE_STEER_DISTANCE,
            },
            runOrWalk(),
            delta,
          )
          return
        }

        const target = behavior.target
        if (!target) return

        const targetPos = target.get(Position)
        const targetBody = target.get(CharacterController)
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
        // Ritmo dos golpes e descanso pela dificuldade (`resolveAiTuning`).
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
              candidates,
              behavior.attackSlot,
            )
        behavior.attackSlot = plan?.slot ?? null
        const reach =
          plan?.reach ??
          resolveAttackReach(entity, species, resolveEntityHitTrigger(target))
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
          behavior.attackTimer = tuning.ATTACK_INTERVAL
          behavior.lastAttackSlot = plan.slot
          behavior.attackSlot = null
        }
      },
    )

  // Fora da query: tirar a entidade do mundo muda o que ela percorre.
  for (const entity of left) despawnarSelvagem(world, events, entity, 'fled')
}
