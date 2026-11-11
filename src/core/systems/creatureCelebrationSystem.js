import {
  comecarComemoracao,
  isPlayerActing,
  pararComemoracao,
  resolveCelebrationDuration,
} from '../actions/celebration'
import { resolveLocalTrainer } from '../actions/owner'
import { EVENT_TYPES } from '../events'
import {
  ActionState,
  Fainted,
  OwnedBy,
  PendingCelebration,
  SummonedCreature,
  Velocity,
} from '../traits'

/**
 * Comemoração ao subir de nível (docs/features/067-campo-de-treino-e-avisos-
 * de-nivel.md, `core/actions/celebration.js`): quem pediu
 * (`PendingCelebration`) começa a ação `'happy'` assim que fica livre, e
 * quem comemora fica parado até o fim do clipe. Quem a moveria (follow, IA
 * de luta, treino, controle direto) já respeita `ActionState.current !==
 * null`.
 *
 * Dono de escrita: `ActionState` enquanto `current === 'happy'`, e
 * `PendingCelebration`.
 * Fase: simulation, antes do treino e do ataque (pra ela começar antes de a
 * IA pedir o próximo golpe).
 */
export function creatureCelebrationSystem(context) {
  const { world, delta } = context
  const finished = []

  world
    .query(SummonedCreature, ActionState, Velocity)
    .updateEach(([creature, action, vel], entity) => {
      if (action.current === 'happy') {
        vel.x = 0
        vel.z = 0
        action.elapsed += delta
        const duration = resolveCelebrationDuration(creature.speciesId)
        if (action.elapsed >= duration) action.current = null
        return
      }
      if (!entity.has(PendingCelebration)) return
      if (entity.has(Fainted)) {
        finished.push(entity)
        return
      }
      if (action.current === null) {
        comecarComemoracao(entity, action)
        finished.push(entity)
        return
      }
      const timeLeft = entity.get(PendingCelebration).timeLeft - delta
      if (timeLeft <= 0) {
        finished.push(entity)
        return
      }
      entity.set(PendingCelebration, { timeLeft })
    })

  for (const entity of finished) {
    if (entity.isAlive() && entity.has(PendingCelebration)) {
      entity.remove(PendingCelebration)
    }
  }
}

/**
 * Qualquer ação do jogador (`isPlayerActing`: andar, golpe, pulo, dash,
 * invocar, trocar o controle, interagir...) corta a comemoração das
 * criaturas dele — a em andamento e a que esperava. Câmera e zoom não
 * contam.
 *
 * Fase: input, logo depois do `inputSystem` e antes do menu de ações (que
 * engole o aperto de Q/E/R).
 */
export function celebrationInputSystem(context) {
  const { world } = context
  if (!isPlayerActing(context.input)) return
  const trainer = resolveLocalTrainer(world)
  if (!trainer) return

  const owned = world.query(SummonedCreature, OwnedBy(trainer))
  for (const creature of owned) pararComemoracao(creature)
}

// Eventos de dano (o alvo perdeu HP neste passo).
const DAMAGE_EVENTS = new Set([
  EVENT_TYPES.ATTACK_RESOLVED,
  EVENT_TYPES.CONDITION_TICKED,
])

/**
 * Tomar dano corta a comemoração (como corta quem come, ver
 * `eatingInterruptSystem`). Golpe de status (sem dano) não corta.
 *
 * Headless. Fase: events.
 */
export function celebrationDamageSystem(context) {
  const { events } = context
  for (const event of events.stepEvents()) {
    if (!DAMAGE_EVENTS.has(event.type)) continue
    if (!(event.damage > 0)) continue
    const target = event.target
    if (!target?.isAlive?.() || !target.has(SummonedCreature)) continue
    pararComemoracao(target)
  }
}
