import { GAME_CONFIG } from '../gameConfig'
import { voltarParaABola } from '../actions/followLimit'
import { resolveGroupLeader, resolveOwner } from '../actions/owner'
import {
  isTooFar,
  quantizeTimeLeft,
  resolveRecallCountdown,
  resolveStrayReason,
  resolveStuckStep,
  resolveTooFarWarning,
} from '../party/followLimit'
import {
  ActionState,
  Fainted,
  FollowWatch,
  InputControlled,
  Party,
  PartyBehavior,
  PathState,
  Position,
  StrayRecall,
  StrayWarning,
  TrainerBehavior,
  Training,
} from '../traits'

// O motivo visto do treinador: quem ficou longe/preso foi ELE.
const TRAINER_REASONS = { far: 'trainerFar', stuck: 'trainerStuck' }

/**
 * Se quem segue está TENTANDO andar até o líder agora: o
 * `creatureFollowSystem` o move (não está lutando, treinando, numa ação nem
 * no treinador fora do seguir) e a marcha dele não é a parada. Só assim
 * não sair do lugar conta como preso.
 */
function isTryingToFollow(entity) {
  if (entity.get(PartyBehavior)?.state === 'fight') return false
  if (entity.has(Training)) return false
  const trainerState = entity.get(TrainerBehavior)?.state
  if (trainerState && trainerState !== 'follow') return false
  if (entity.get(ActionState)?.current) return false
  return entity.get(PathState)?.gait !== 'stop'
}

/** Sem líder (é ele quem está no controle) ou desmaiado: tudo zerado. */
function resetWatch(watch, pos) {
  watch.anchorX = pos.x
  watch.anchorZ = pos.z
  watch.stuckTime = 0
  watch.joined = false
  watch.warned = false
  watch.pendingReason = null
  watch.timeLeft = 0
}

/** Põe, atualiza ou tira o aviso da tela — só escreve quando muda. */
function applyWarning(entity, warning) {
  if (!warning) {
    if (entity.has(StrayWarning)) entity.remove(StrayWarning)
    return
  }
  if (!entity.has(StrayWarning)) {
    entity.add(StrayWarning(warning))
    return
  }
  const current = entity.get(StrayWarning)
  const changed = Object.keys(warning).some(
    (key) => current[key] !== warning[key],
  )
  if (changed) entity.set(StrayWarning, warning)
}

/**
 * Quem ficou para trás volta para a bola, com aviso antes
 * (docs/features/064-revisao-da-ia-do-parceiro.md, Parte 1).
 *
 * Vigia todo seguidor com `FollowWatch` — a criatura do time e o treinador,
 * que segue quando o controle está numa criatura:
 * - **criatura** longe demais de quem está no controle
 *   (`FOLLOW_LIMIT.RECALL_DISTANCE`, depois de ter chegado perto uma vez) ou
 *   presa (tentando seguir sem sair de `STUCK_RADIUS` por `STUCK_TIME`) →
 *   começa a contagem (`WARNING_TIME`) e, no fim, ela volta para a bola;
 * - **treinador** longe demais da controlada ou preso → a CONTROLADA conta e
 *   volta (e o controle volta para ele). Antes disso, passou de
 *   `WARN_DISTANCE`, aviso sem contagem.
 *
 * Resolvido no meio da contagem (voltou para perto, desprendeu), cancela. O
 * aviso vai para a tela pelo `StrayWarning` da criatura que vai voltar. A
 * distância vale mesmo num chunk descarregado (quem ficou longe pode estar
 * congelado lá). A desmaiada não entra: o desmaio já a recolhe. Só pede a
 * volta (`voltarParaABola`); quem recolhe é o `partySummonSystem.js`.
 *
 * Duas passadas: decide lendo e aplica depois. O aviso pode cair em outra
 * entidade que não a da query (a controlada, pelo treinador), então os
 * avisos do tick são juntados por criatura e quem não recebeu nenhum perde
 * o seu.
 *
 * Headless. Fase: simulation, antes do `partySummonSystem` (que recolhe no
 * mesmo tick, com o treinador livre).
 */
export function followLimitSystem(context) {
  const { world, events, delta } = context
  const LIMIT = GAME_CONFIG.PARTY_BEHAVIOR.FOLLOW_LIMIT
  const { DISPLAY_STEP } = GAME_CONFIG.FEEDBACK.RECALL_WARNING

  const strays = []
  const warnings = new Map()

  world.query(FollowWatch, Position).updateEach(([watch, pos], entity) => {
    const leader =
      entity.has(InputControlled) || entity.has(Fainted)
        ? null
        : resolveGroupLeader(world, resolveOwner(entity))
    if (!leader || leader === entity) {
      resetWatch(watch, pos)
      return
    }

    const leaderPos = leader.get(Position)
    const distance = Math.hypot(leaderPos.x - pos.x, leaderPos.z - pos.z)
    if (distance <= LIMIT.RECALL_DISTANCE) watch.joined = true
    const stuck = resolveStuckStep(watch, pos, {
      isTrying: isTryingToFollow(entity),
      delta,
      stuckRadius: LIMIT.STUCK_RADIUS,
    })
    watch.anchorX = stuck.anchorX
    watch.anchorZ = stuck.anchorZ
    watch.stuckTime = stuck.stuckTime

    // O treinador seguindo: quem volta é a controlada que ele segue.
    const isTrainer = entity.has(Party)
    const stray = isTrainer ? leader : entity
    const toReason = (reason) => (isTrainer ? TRAINER_REASONS[reason] : reason)
    // Já vai voltar: mantém o aviso até ela sumir.
    if (stray.has(StrayRecall)) {
      warnings.set(stray, stray.get(StrayWarning) ?? null)
      return
    }

    const far = isTooFar(distance, {
      joined: watch.joined,
      counting: watch.pendingReason === 'far',
      recallDistance: LIMIT.RECALL_DISTANCE,
      cancelMargin: LIMIT.CANCEL_MARGIN,
    })
    const reason = resolveStrayReason(far, watch.stuckTime, {
      stuckTimeLimit: LIMIT.STUCK_TIME,
    })
    const countdown = resolveRecallCountdown(
      watch.pendingReason !== null,
      watch.timeLeft,
      reason,
      { delta, warningTime: LIMIT.WARNING_TIME },
    )
    watch.pendingReason = countdown.reason
    watch.timeLeft = countdown.timeLeft

    if (countdown.fire) {
      strays.push({ creature: stray, reason: toReason(reason) })
      watch.stuckTime = 0
      watch.pendingReason = null
    }
    if (countdown.reason) {
      warnings.set(stray, {
        stage: 'recall',
        reason: toReason(countdown.reason),
        duration: LIMIT.WARNING_TIME,
        timeLeft: quantizeTimeLeft(countdown.timeLeft, DISPLAY_STEP),
      })
      return
    }

    if (!isTrainer) return
    watch.warned =
      watch.joined &&
      resolveTooFarWarning(distance, watch.warned, {
        warnDistance: LIMIT.WARN_DISTANCE,
        resetDistance: LIMIT.WARN_RESET_DISTANCE,
      })
    if (watch.warned) {
      warnings.set(stray, {
        stage: 'warn',
        reason: 'trainerFar',
        duration: 0,
        timeLeft: 0,
      })
    }
  })

  for (const { creature, reason } of strays) {
    voltarParaABola(events, creature, reason)
  }
  // Quem tinha aviso e não ganhou nenhum neste tick perde o seu.
  const stale = world
    .query(StrayWarning)
    .filter((entity) => !warnings.has(entity))
  for (const entity of stale) applyWarning(entity, null)
  for (const [entity, warning] of warnings) applyWarning(entity, warning)
}
