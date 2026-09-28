import { GAME_CONFIG } from '../gameConfig'
import { setCharacterColliderEnabled } from '../physics/colliders'
import {
  ActionState,
  AttackAim,
  CameraTarget,
  CombatMode,
  Fainted,
  InputControlled,
  Mood,
  Party,
  PartyBehavior,
  PhysicsBody,
  Position,
  Velocity,
  Vitals,
  WantsToAttack,
  WildCreature,
} from '../traits'
import { voltarAVagar } from './wildBehavior'

/**
 * A criatura desmaia (chegou a 0 de HP): começa a contagem pra acordar
 * (`FAINT.DURATION_MINUTES`), larga o que estava fazendo (golpe em
 * andamento, mira, pedido de golpe, modo combate, luta da IA do time),
 * para, fecha o olho (`Mood` `'faint'`, o `eyeStates.faint` da espécie)
 * e fica intangível (collider desligado). Se era
 * quem estava no controle, o controle volta pro treinador — desmaiada ela
 * não se mexe.
 *
 * Não mexe no `WildBehavior`: os systems ignoram quem tem `Fainted`, e
 * `acordar` põe a selvagem pra vagar de novo.
 */
export function desmaiar(world, entity) {
  entity.add(
    Fainted({ timeLeft: GAME_CONFIG.FAINT.DURATION_MINUTES * 60, elapsed: 0 }),
  )

  if (entity.has(ActionState)) {
    entity.set(ActionState, {
      current: null,
      elapsed: 0,
      animationSpeed: 1,
      pendingSlot: null,
    })
  }
  if (entity.has(AttackAim)) entity.set(AttackAim, { slot: null })
  if (entity.has(WantsToAttack)) entity.remove(WantsToAttack)
  if (entity.has(CombatMode)) entity.remove(CombatMode)
  if (entity.has(PartyBehavior)) {
    entity.set(PartyBehavior, { state: 'follow', target: null })
  }
  if (entity.has(Mood)) entity.set(Mood, { state: 'faint' })
  if (entity.has(Velocity)) entity.set(Velocity, { x: 0, z: 0 })
  if (entity.has(PhysicsBody)) {
    setCharacterColliderEnabled(entity.get(PhysicsBody).colliderHandle, false)
  }

  if (entity.has(InputControlled)) {
    const trainer = world.queryFirst(Party)
    if (trainer) {
      entity.remove(InputControlled, CameraTarget)
      trainer.add(InputControlled, CameraTarget)
    }
  }
}

/**
 * A criatura acorda: volta a ser tangível, com `FAINT.REVIVE_HP_FRACTION`
 * do HP (a regeneração normal segue dali), olho aberto. A selvagem volta
 * a vagar a partir de onde caiu — daí em diante, o comportamento normal
 * dela (hostil volta a perseguir quem chegar perto).
 */
export function acordar(entity) {
  entity.remove(Fainted)

  const vitals = entity.get(Vitals)
  if (vitals) {
    // Sem o atraso de regeneração do último golpe: já acorda regenerando.
    entity.set(Vitals, { hp: resolveReviveHp(vitals.maxHp), hpRegenDelay: 0 })
  }
  if (entity.has(Mood)) entity.set(Mood, { state: 'awake' })
  if (entity.has(PhysicsBody)) {
    setCharacterColliderEnabled(entity.get(PhysicsBody).colliderHandle, true)
  }
  if (entity.has(WildCreature)) voltarAVagar(entity, entity.get(Position))
}

/**
 * HP com que uma criatura acorda do desmaio — `REVIVE_HP_FRACTION` do
 * máximo, arredondado pra cima (nunca acorda com 0). Exportado: a do time
 * que reanimou dentro da bola nasce com isso (`summonBallSystem.js`).
 */
export function resolveReviveHp(maxHp) {
  return Math.max(1, Math.ceil(maxHp * GAME_CONFIG.FAINT.REVIVE_HP_FRACTION))
}
