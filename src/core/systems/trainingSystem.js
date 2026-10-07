import { GAME_CONFIG } from '../gameConfig'
import { getSpecies } from '../data/species'
import { lerpAngle } from '../math'
import {
  resolveAttackForEntity,
  resolveDirectionTo,
  tryStartAttack,
} from '../battle/attackCasting'
import { isSelfAttack } from '../battle/channelAttack'
import { resolveTrainingHours } from '../battle/actionCost'
import { TRAINING_SLOT, resolveEntityMoveSet } from '../battle/creatureAttack'
import { pararTreino, resolveTrainingGoal } from '../actions/training'
import { progredirTreino, treinarDominio } from '../actions/moves'
import { resolvePokemonOf } from '../actions/pokemon'
import {
  ActionState,
  AttackCooldowns,
  Fainted,
  IndividualValues,
  InputControlled,
  MovementStats,
  PhysicsBody,
  Position,
  Rotation,
  SummonedCreature,
  Training,
  TrainingObject,
  Velocity,
  Vitals,
  resolveEntityLevel,
} from '../traits'

// Fração do alcance em que a criatura para pra treinar (folga pra não ficar
// na borda exata do golpe).
const REACH_FRACTION = 0.8

/**
 * Treino automático de golpe (docs/features/038-aprendizado-treino-e-
 * dominio-de-golpes.md): a criatura com `Training` anda até o alcance do
 * golpe no objeto de treino e repete o golpe sozinha (slot interno
 * `'training'`), sem entrar em combate. Sem energia pra repetir, descansa até
 * `REST_STAMINA_FRACTION`.
 *
 * O treino conta TEMPO, não repetições: o tempo no objeto (repetindo,
 * esperando a recarga ou descansando — não o de ir até ele), vezes
 * `TIME_MULTIPLIER`, é creditado a cada repetição concluída, sobre as horas
 * do golpe (`resolveTrainingHours`: o peso, a régua da energia):
 * - golpe APTO → progresso pra aprender (`progredirTreino`); completo, ela
 *   aprende (ou o treinador escolhe o que esquecer) e o treino acaba;
 * - golpe EQUIPADO → domínio (`treinarDominio`); dominado, o treino acaba.
 *
 * Só sai do treino em três casos (decisão do usuário): o treinador assume o
 * controle dela, recolhe ela, ou alguém a ataca (`partyReactionSystem`). O
 * treinador se afastar ou o resto do time entrar numa luta não a tiram do
 * treino; se ela for empurrada pra longe, volta andando até o objeto.
 *
 * Headless. Fase: simulation, antes do `creatureAttackSystem` (o golpe pedido
 * aqui sai pelo mesmo `tryStartAttack` e avança no mesmo tick). Quem a coloca
 * em luta (`partyReactionSystem`/`partyBehaviorSystem`) roda depois — o
 * treino para no tick seguinte.
 */
export function trainingSystem(context) {
  const { world, delta, events } = context
  const { REPETITION_INTERVAL, TIME_MULTIPLIER } = GAME_CONFIG.MOVES.TRAINING

  const stopped = []
  const repetitions = []

  world
    .query(
      Training,
      SummonedCreature,
      ActionState,
      AttackCooldowns,
      PhysicsBody,
      Vitals,
      Position,
      Rotation,
      Velocity,
      MovementStats,
      IndividualValues,
    )
    .updateEach(
      (
        [
          training,
          creature,
          action,
          cooldowns,
          physicsBody,
          vitals,
          pos,
          rot,
          vel,
          stats,
          individualValues,
        ],
        entity,
      ) => {
        // Só sai do treino se for pilotada (ou desmaiar). Recolher destrói a
        // criatura, e ser atacada para o treino no `partyReactionSystem`.
        const object = training.object
        if (
          entity.has(InputControlled) ||
          entity.has(Fainted) ||
          !object?.isAlive?.()
        ) {
          stopped.push(entity)
          return
        }

        const objectPos = object.get(Position)
        const objectRadius = object.get(TrainingObject).radius
        const distance =
          Math.hypot(objectPos.x - pos.x, objectPos.z - pos.z) - objectRadius

        const species = getSpecies(creature.speciesId)
        const level = resolveEntityLevel(entity, species)
        const moveSet = resolveEntityMoveSet(entity, species)
        const attack = resolveAttackForEntity(
          species,
          TRAINING_SLOT,
          individualValues,
          level,
          moveSet,
        )
        if (!attack) {
          stopped.push(entity)
          return
        }

        // Fim de uma repetição: o golpe de treino acabou.
        if (training.repeating && action.current === null) {
          training.repeating = false
          training.wait = REPETITION_INTERVAL
          repetitions.push({
            entity,
            moveId: training.moveId,
            seconds: training.elapsed,
            hours: resolveTrainingHours(attack),
          })
          training.elapsed = 0
        }

        // Só fica `true` no fim do tick, se ela estiver parada esperando.
        training.waiting = false

        // Golpe (ou outra ação, ex.: apresentação) em andamento: parada.
        if (action.current !== null) {
          if (action.pendingSlot === TRAINING_SLOT) {
            training.repeating = true
            training.elapsed += delta * TIME_MULTIPLIER
          }
          vel.x = 0
          vel.z = 0
          return
        }

        training.resting = resolveTrainingRest(
          training.resting,
          vitals,
          attack.staminaCost,
        )

        // Golpe em si mesmo não precisa chegar perto; os outros, até o
        // alcance (somado ao raio do objeto).
        const reach = isSelfAttack(attack)
          ? Infinity
          : attack.range * REACH_FRACTION
        const facing = Math.atan2(objectPos.x - pos.x, objectPos.z - pos.z)
        if (distance > reach) {
          rot.y = lerpAngle(rot.y, facing, stats.turnSpeed * delta)
          vel.x = Math.sin(rot.y) * stats.walkSpeed
          vel.z = Math.cos(rot.y) * stats.walkSpeed
          return
        }

        vel.x = 0
        vel.z = 0
        // No objeto: repetindo, esperando ou descansando, o tempo conta.
        training.elapsed += delta * TIME_MULTIPLIER
        training.wait = Math.max(0, training.wait - delta)
        if (training.resting || training.wait > 0) {
          rot.y = lerpAngle(rot.y, facing, stats.turnSpeed * delta)
          training.waiting = true
          return
        }

        const started = tryStartAttack(
          {
            entity,
            world,
            species,
            individualValues,
            level,
            moveSet,
            action,
            cooldowns,
            vitals,
            pos,
            rot,
            physicsBody,
          },
          TRAINING_SLOT,
          resolveDirectionTo(pos, objectPos, rot),
          { enterCombat: false },
        )
        if (started) training.repeating = true
        // Sem lançar (ex.: golpe ainda recarregando): espera descansando.
        else training.waiting = true
      },
    )

  // Fora do `updateEach`: tirar `Training` muda a query iterada.
  for (const entity of stopped) pararTreino(entity)

  for (const { entity, moveId, seconds, hours } of repetitions) {
    // O treino conta no registro DELA (`SummonedFrom`).
    const pokemon = resolvePokemonOf(entity)
    if (!pokemon) continue
    if (!creditTraining(world, events, pokemon, moveId, seconds, hours)) {
      pararTreino(entity)
    }
  }
}

const SECONDS_PER_HOUR = 3600

/**
 * Credita `seconds` de treino no golpe, conforme o objetivo de agora
 * (`resolveTrainingGoal`): fração das horas de aprender, ou das de dominar.
 * Devolve se o treino continua (falta aprender/dominar).
 */
function creditTraining(world, events, pokemon, moveId, seconds, hours) {
  const goal = resolveTrainingGoal(pokemon, moveId)
  if (goal === 'learn') {
    const progress = progredirTreino(
      world,
      events,
      pokemon,
      moveId,
      seconds / (hours.learn * SECONDS_PER_HOUR),
    )
    return progress !== null && progress < 1
  }
  if (goal === 'master') {
    treinarDominio(
      world,
      pokemon,
      moveId,
      seconds / (hours.mastery * SECONDS_PER_HOUR),
    )
    return resolveTrainingGoal(pokemon, moveId) === 'master'
  }
  return false
}

/**
 * Descanso do treino: entra quando a energia não paga mais o golpe; sai ao
 * recuperar `REST_STAMINA_FRACTION` da máxima.
 */
export function resolveTrainingRest(resting, vitals, cost) {
  const { REST_STAMINA_FRACTION } = GAME_CONFIG.MOVES.TRAINING
  if (resting) return vitals.stamina < vitals.maxStamina * REST_STAMINA_FRACTION
  return vitals.stamina < cost
}
