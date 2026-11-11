import * as THREE from 'three'
import { TRAINING_SLOT } from '@/core/battle/creatureAttack'
import { resolveSkill } from '@/core/data/skills'
import { EVENT_TYPES } from '@/core/events'
import { GAME_CONFIG } from '@/core/gameConfig'
import { Position, Training } from '@/core/traits'
import {
  getTrainingDummyTilt,
  startTrainingDummyWobble,
  trainingDummyWobbles,
} from '../registry/trainingDummyRegistry'

/**
 * O eixo no chão em volta do qual o boneco inclina para longe de quem bateu
 * (a direção de `from` para `to`); no mesmo lugar, `null`.
 */
export function wobbleAxisOf(from, to) {
  const dx = to.x - from.x
  const dz = to.z - from.z
  const length = Math.hypot(dx, dz)
  if (length < 1e-6) return null
  return new THREE.Vector3(dz / length, 0, -dx / length)
}

/**
 * A inclinação (rad) do balanço `elapsed` s depois do golpe: começa
 * inclinando para longe de quem bateu e vai e volta diminuindo.
 */
export function wobbleAngleAt(elapsed, wobble) {
  const { AMPLITUDE, FREQUENCY, DAMPING } = wobble
  return (
    AMPLITUDE *
    Math.exp(-DAMPING * elapsed) *
    Math.sin(2 * Math.PI * FREQUENCY * elapsed)
  )
}

/**
 * Balanço do boneco de treino (docs/features/067-campo-de-treino-e-avisos-
 * de-nivel.md): cada golpe de treino (`attackUsed` no slot de treino, no
 * instante do efeito) balança o boneco em que a criatura treina — menos o
 * golpe em si mesmo (Growth, Withdraw...), que não acerta o boneco, e o que
 * falhou por falta de domínio (o `attackFailed` sai logo depois do
 * `attackUsed`, no mesmo passo). Os números em
 * `FEEDBACK.TRAINING_DUMMY_WOBBLE`.
 *
 * Fase: presentation (lê `context.frameEvents`).
 */
export function trainingDummyWobbleSystem(context) {
  const { delta } = context
  const events = context.frameEvents ?? []
  // Quem teve o golpe de treino falhado neste frame.
  const failed = new Set(
    events
      .filter(
        (event) =>
          event.type === EVENT_TYPES.ATTACK_FAILED &&
          event.slot === TRAINING_SLOT,
      )
      .map((event) => event.entity),
  )
  for (const event of events) {
    if (event.type !== EVENT_TYPES.ATTACK_USED) continue
    if (event.slot !== TRAINING_SLOT) continue
    const attacker = event.entity
    if (failed.has(attacker)) continue
    if (!attacker?.isAlive?.() || !attacker.has(Training)) continue
    if (resolveSkill(event.attackId)?.area === 'self') continue
    const object = attacker.get(Training).object
    if (!object?.isAlive?.()) continue
    const axis = wobbleAxisOf(attacker.get(Position), object.get(Position))
    if (axis) startTrainingDummyWobble(object, axis)
  }

  const wobble = GAME_CONFIG.FEEDBACK.TRAINING_DUMMY_WOBBLE
  const wobbles = trainingDummyWobbles()
  for (const [entity, state] of wobbles) {
    const tilt = getTrainingDummyTilt(entity)
    if (!tilt) {
      wobbles.delete(entity)
      continue
    }
    state.elapsed += delta
    if (state.elapsed >= wobble.DURATION) {
      tilt.quaternion.identity()
      wobbles.delete(entity)
      continue
    }
    tilt.quaternion.setFromAxisAngle(
      state.axis,
      wobbleAngleAt(state.elapsed, wobble),
    )
  }
}
